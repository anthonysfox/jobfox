import Anthropic from "@anthropic-ai/sdk";
import type { JobfoxConfig } from "../core/config.ts";
import type { PrismaClient } from "../lib/db.ts";
import type { MatchedJob } from "../pipeline/matches.ts";
import type { ScoringContext } from "./context.ts";
import { currentScore } from "./context.ts";
import { addUsage, emptyUsage, estimateCost, type UsageTotals } from "./cost.ts";
import { jobEmbeddingText, type Embedder } from "./embed.ts";
import { createScorer } from "./scorer.ts";
import { jobsMissingEmbeddings, rankBySimilarity, saveEmbedding } from "./store.ts";

export interface ScoreRunResult {
  embedded: number;
  scored: number;
  failures: string[];
  skippedOverLimit: number;
  usage: UsageTotals;
  costUsd: number | null;
}

/** Embed any matches that lack an embedding. Returns how many were embedded. */
export async function embedMissing(
  db: PrismaClient,
  embedder: Embedder,
  jobs: MatchedJob[],
): Promise<number> {
  const missing = new Set(
    await jobsMissingEmbeddings(
      db,
      jobs.map((j) => j.id),
    ),
  );
  const toEmbed = jobs.filter((j) => missing.has(j.id));
  const vectors = await embedder.embedDocuments(
    toEmbed.map((j) => jobEmbeddingText({ ...j, companyName: j.company.name })),
  );
  for (const [i, job] of toEmbed.entries()) {
    const vector = vectors[i];
    if (vector) await saveEmbedding(db, job.id, vector);
  }
  return toEmbed.length;
}

/** Run `task` over `items` with at most `limit` in flight. */
async function forEachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
  });
  await Promise.all(workers);
}

export interface ScoreJobsOptions {
  db: PrismaClient;
  client: Anthropic;
  embedder: Embedder;
  config: JobfoxConfig;
  context: ScoringContext;
  jobs: MatchedJob[];
  /** Score these even if they fall outside maxJobsPerRun (used by the eval). */
  alwaysInclude?: Set<string>;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Embed, rank by similarity to the resume, then send the most similar
 * unscored jobs to Claude. Jobs already scored for this prompt and model are skipped.
 */
export async function scoreJobs(options: ScoreJobsOptions): Promise<ScoreRunResult> {
  const { db, client, embedder, config, context, jobs } = options;
  const embedded = await embedMissing(db, embedder, jobs);

  const resumeVector = await embedder.embedQuery(context.resume);
  const similarity = await rankBySimilarity(
    db,
    jobs.map((j) => j.id),
    resumeVector,
  );

  const unscored = jobs
    .filter((j) => similarity.has(j.id) && !currentScore(j.scores, context))
    .sort((a, b) => (similarity.get(b.id) ?? 0) - (similarity.get(a.id) ?? 0));
  const required = unscored.filter((j) => options.alwaysInclude?.has(j.id));
  const rest = unscored.filter((j) => !options.alwaysInclude?.has(j.id));
  const toScore = [
    ...required,
    ...rest.slice(0, Math.max(0, config.scoring.maxJobsPerRun - required.length)),
  ];

  const score = createScorer({
    client,
    systemPrompt: context.systemPrompt,
    config: config.scoring,
  });
  const usage = emptyUsage();
  const failures: string[] = [];
  let done = 0;

  async function scoreOne(job: MatchedJob) {
    try {
      const outcome = await score({ ...job, companyName: job.company.name });
      if (outcome.usage) addUsage(usage, outcome.usage);
      if (!outcome.ok) {
        failures.push(`${job.company.name} — ${job.title}: ${outcome.reason}`);
        return;
      }
      await db.jobScore.create({
        data: {
          jobId: job.id,
          resumeHash: context.promptHash,
          model: context.model,
          similarity: similarity.get(job.id) ?? 0,
          ...outcome.fit,
        },
      });
    } catch (error) {
      // A bad key or exhausted credit won't fix itself on the next job.
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${job.company.name} — ${job.title}: ${message}`);
    } finally {
      options.onProgress?.(++done, toScore.length);
    }
  }

  // Score one job alone first so the cached system prompt exists before the rest run in parallel.
  const [first, ...others] = toScore;
  if (first) await scoreOne(first);
  await forEachLimited(others, config.scoring.concurrency, scoreOne);

  return {
    embedded,
    scored: toScore.length - failures.length,
    failures,
    skippedOverLimit: unscored.length - toScore.length,
    usage,
    costUsd: estimateCost(config.scoring.model, usage),
  };
}
