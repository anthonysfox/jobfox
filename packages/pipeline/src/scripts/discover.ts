import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import type { Ats, Job } from "../core/job.ts";
import type { JobSource } from "../core/source.ts";
import { createDb } from "../lib/db.ts";
import { createHttpClient } from "../lib/http.ts";
import { canonicalize, groupJobs } from "../pipeline/dedupe.ts";
import { enrichGroup } from "../pipeline/enrich.ts";
import { rejectReasons } from "../pipeline/filters.ts";
import { listPollableCompanies, markPolled, persistGroup } from "../pipeline/persist.ts";
import { formatSummary, type RunSummary, type SourceReport } from "../pipeline/summary.ts";
import { ADZUNA_HOST } from "../sources/adzuna/client.ts";
import { createAdzunaSource } from "../sources/adzuna/source.ts";
import { ASHBY_API_HOST } from "../sources/ats/ashby/client.ts";
import { GREENHOUSE_API_HOST } from "../sources/ats/greenhouse/client.ts";
import { atsClients, createAtsBoardSource } from "../sources/ats/index.ts";
import { LEVER_API_HOST } from "../sources/ats/lever/client.ts";
import { NotImplementedError } from "../sources/ats/types.ts";
import { HN_ALGOLIA_HOST } from "../sources/hn/client.ts";
import { createHnSource } from "../sources/hn/source.ts";

async function main(): Promise<number> {
  const startedAt = new Date();
  const env = parseEnv(process.env);
  const config = parseConfig(userConfig);
  const db = createDb();

  // Per-host spacing. Adzuna's free tier allows roughly 25 requests a minute.
  const http = createHttpClient({
    minIntervalMs: 1000,
    hostIntervalsMs: {
      [ADZUNA_HOST]: 2500,
      [HN_ALGOLIA_HOST]: 250,
      [GREENHOUSE_API_HOST]: 1000,
      [LEVER_API_HOST]: 1000,
      [ASHBY_API_HOST]: 1000,
    },
  });

  try {
    const sources: JobSource[] = [];
    const reports: SourceReport[] = [];

    if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) {
      sources.push(
        createAdzunaSource({
          http,
          credentials: { appId: env.ADZUNA_APP_ID, appKey: env.ADZUNA_APP_KEY },
          config: config.adzuna,
        }),
      );
    } else {
      reports.push({
        name: "adzuna",
        status: "skipped",
        jobs: 0,
        detail: "no ADZUNA_APP_ID / ADZUNA_APP_KEY in .env",
      });
    }
    if (config.hn.enabled) sources.push(createHnSource({ http }));

    const companies = await listPollableCompanies(db);
    const boardSources = new Map<JobSource, string>();
    for (const c of companies) {
      if (!c.ats || !c.atsSlug) continue;
      const source = createAtsBoardSource(http, c.ats, { slug: c.atsSlug, companyName: c.name });
      sources.push(source);
      boardSources.set(source, c.id);
    }

    // One failing source never sinks the run.
    const results = await Promise.allSettled(sources.map((s) => s.fetchJobs()));
    const jobs: Job[] = [];
    const polledCompanyIds: string[] = [];
    results.forEach((result, i) => {
      const source = sources[i];
      if (!source) return;
      if (result.status === "fulfilled") {
        jobs.push(...result.value);
        reports.push({ name: source.name, status: "ok", jobs: result.value.length });
        const companyId = boardSources.get(source);
        if (companyId) polledCompanyIds.push(companyId);
      } else if (result.reason instanceof NotImplementedError) {
        reports.push({ name: source.name, status: "skipped", jobs: 0 });
      } else {
        reports.push({
          name: source.name,
          status: "failed",
          jobs: 0,
          detail: String(result.reason),
        });
      }
    });

    const groups = groupJobs(jobs);
    const filter = (job: Parameters<typeof rejectReasons>[0]) => rejectReasons(job, config.filters);

    const summary: RunSummary = {
      startedAt,
      durationMs: 0,
      sources: reports,
      postings: jobs.length,
      groups: groups.length,
      newMatches: [],
      newRejected: 0,
      seenBefore: 0,
      rejectCounts: new Map(),
      atsDescriptionsAdded: 0,
      boardsAdded: [],
      notImplemented: new Map<Ats, number>(),
      errors: reports.filter((r) => r.status === "failed").map((r) => `${r.name}: ${r.detail}`),
    };

    for (const group of groups) {
      // Only spend ATS requests on jobs that pass the hard filters.
      const preview = canonicalize(group.postings);
      const outcome =
        filter(preview).length === 0
          ? await enrichGroup(group, preview.companyName, { http, clients: atsClients })
          : null;

      if (outcome?.attached) summary.atsDescriptionsAdded++;
      if (outcome?.notImplemented) {
        const ats = outcome.notImplemented;
        summary.notImplemented.set(ats, (summary.notImplemented.get(ats) ?? 0) + 1);
      }
      if (outcome?.error) summary.errors.push(`enrich ${group.key}: ${outcome.error}`);

      const board = outcome?.board ? { ats: outcome.board.ats, slug: outcome.board.slug } : null;
      const result = await persistGroup(db, group, { board, filter });

      if (result.boardAdded && board) summary.boardsAdded.push(board);
      if (!result.isNew) {
        summary.seenBefore++;
      } else if (result.rejectedReasons.length === 0) {
        summary.newMatches.push(result.canonical);
      } else {
        summary.newRejected++;
        for (const reason of result.rejectedReasons) {
          summary.rejectCounts.set(reason, (summary.rejectCounts.get(reason) ?? 0) + 1);
        }
      }
    }

    await markPolled(db, polledCompanyIds);
    summary.durationMs = Date.now() - startedAt.getTime();
    console.log(formatSummary(summary));

    return reports.some((r) => r.status === "ok") ? 0 : 1;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
