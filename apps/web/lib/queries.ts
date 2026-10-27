import "server-only";
import userConfig from "@jobfox/pipeline/config";
import { parseConfig } from "@jobfox/pipeline/core/config";
import { containsPhrase } from "@jobfox/pipeline/lib/normalize";
import { findCurrentMatches, type MatchedJob } from "@jobfox/pipeline/pipeline/matches";
import { spreadEvenly } from "@jobfox/pipeline/scoring/metrics";
import { toVerdict, type Verdict } from "@jobfox/pipeline/scoring/scorer";
import { db } from "./db";

export const config = parseConfig(userConfig);

export type Score = MatchedJob["scores"][number] & { verdict: Verdict };
export interface JobRow {
  job: MatchedJob;
  score: Score | undefined;
}

/**
 * The newest score from the configured model, with its verdict under the current
 * thresholds. The CLI matches on the exact prompt hash; the dashboard shows the
 * latest so it doesn't need the resume file.
 */
export function latestScore(scores: MatchedJob["scores"]): Score | undefined {
  const latest = scores
    .filter((s) => s.model === config.scoring.model)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest && { ...latest, verdict: toVerdict(latest.fitScore, config.scoring) };
}

export const TABS = ["strong", "possible", "weak", "unscored", "saved", "applied"] as const;
export type Tab = (typeof TABS)[number];

export interface JobFilters {
  area: "all" | "local" | "remote";
  source: "all" | "ats" | "hn" | "adzuna";
  minScore: number;
}

export function parseFilters(params: Record<string, string | string[] | undefined>): {
  tab: Tab;
  filters: JobFilters;
} {
  const one = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const tab = TABS.find((t) => t === one("tab")) ?? "strong";
  const area = one("area");
  const source = one("source");
  return {
    tab,
    filters: {
      area: area === "local" || area === "remote" ? area : "all",
      source: source === "ats" || source === "hn" || source === "adzuna" ? source : "all",
      minScore: Math.min(100, Math.max(0, Number(one("min")) || 0)),
    },
  };
}

export function isLocal(location: string | null): boolean {
  return config.filters.locations.some((place) => containsPhrase(location ?? "", place));
}

function matchesFilters({ job, score }: JobRow, filters: JobFilters): boolean {
  if (filters.area === "local" && !isLocal(job.location)) return false;
  if (filters.area === "remote" && job.workplaceType !== "REMOTE") return false;
  const source = job.descriptionSource;
  if (filters.source === "hn" && source !== "HN_HIRING") return false;
  if (filters.source === "adzuna" && source !== "ADZUNA") return false;
  if (
    filters.source === "ats" &&
    !(source === "GREENHOUSE" || source === "LEVER" || source === "ASHBY")
  ) {
    return false;
  }
  return filters.minScore === 0 || (score?.fitScore ?? 0) >= filters.minScore;
}

function tabOf({ job, score }: JobRow): Tab {
  if (job.status === "APPLIED") return "applied";
  if (job.status === "SAVED") return "saved";
  if (!score) return "unscored";
  return score.verdict === "STRONG" ? "strong" : score.verdict === "POSSIBLE" ? "possible" : "weak";
}

export async function listJobs(tab: Tab, filters: JobFilters) {
  const include = { company: true, scores: true, label: true } as const;
  const [current, applied] = await Promise.all([
    findCurrentMatches(db, config.filters),
    db.job.findMany({
      where: { status: "APPLIED" },
      include,
      orderBy: { statusChangedAt: "desc" },
    }),
  ]);

  const rows = [...current, ...applied]
    .map((job): JobRow => ({ job, score: latestScore(job.scores) }))
    .filter((row) => matchesFilters(row, filters));

  const counts = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<Tab, number>;
  for (const row of rows) counts[tabOf(row)]++;

  const inTab = rows.filter((row) => tabOf(row) === tab);
  if (tab !== "applied") inTab.sort((a, b) => (b.score?.fitScore ?? 0) - (a.score?.fitScore ?? 0));
  return { rows: inTab, counts };
}

export async function getJob(id: string) {
  const job = await db.job.findUnique({
    where: { id },
    include: {
      company: true,
      scores: true,
      label: true,
      postings: { select: { source: true, url: true } },
    },
  });
  return job ? { job, score: latestScore(job.scores) } : null;
}

export const DEFAULT_LABEL_TARGET = 30;

/**
 * The labeling queue: scored current matches spread evenly across the similarity
 * range, so the set includes clear misses. Stable as labels accumulate, because
 * labeled jobs stay in the candidate list.
 */
export async function getLabelQueue(target: number, skipped: Set<string>) {
  const jobs = await findCurrentMatches(db, config.filters);
  const candidates = jobs
    .map((job) => ({ job, score: latestScore(job.scores) }))
    .filter((row): row is { job: MatchedJob; score: Score } => row.score !== undefined)
    .sort((a, b) => b.score.similarity - a.score.similarity);

  const queue = spreadEvenly(candidates, target);
  const labeled = queue.filter((row) => row.job.label).length;
  const next = queue.find((row) => !row.job.label && !skipped.has(row.job.id));
  const totalLabels = await db.jobLabel.count();
  return { next: next?.job, labeled, size: queue.length, totalLabels };
}

export function listEvalRuns() {
  return db.evalRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
}
