import {
  SOURCE_PRIORITY,
  type Job,
  type Salary,
  type Source,
  type WorkplaceType,
} from "../core/job.js";
import { dedupeKey } from "../lib/normalize.js";

/** Postings from one run that describe the same real-world job. */
export interface JobGroup {
  key: string;
  postings: Job[];
}

/** The merged view of a group, which becomes the Job row. */
export interface CanonicalJob {
  companyName: string;
  title: string;
  location: string | null;
  workplaceType: WorkplaceType;
  description: string | null;
  descriptionSource: Source | null;
  applyUrl: string;
  salary: Salary | null;
  postedAt: Date | null;
}

const ATS_SOURCES = new Set<Source>(["GREENHOUSE", "LEVER", "ASHBY"]);

export function isAtsSource(source: Source): boolean {
  return ATS_SOURCES.has(source);
}

/** Groups jobs by dedupe key, keeping first-seen order. */
export function groupJobs(jobs: Job[]): JobGroup[] {
  const groups = new Map<string, JobGroup>();
  for (const job of jobs) {
    const key = dedupeKey(job);
    const group = groups.get(key);
    if (group) group.postings.push(job);
    else groups.set(key, { key, postings: [job] });
  }
  return [...groups.values()];
}

/** Higher source priority first; then full descriptions before truncated ones; then longer. */
function compareQuality(a: Job, b: Job): number {
  return (
    SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source] ||
    Number(a.descriptionTruncated) - Number(b.descriptionTruncated) ||
    (b.description?.length ?? 0) - (a.description?.length ?? 0)
  );
}

export function canonicalize(postings: Job[]): CanonicalJob {
  const ranked = [...postings].sort(compareQuality);
  const best = ranked[0];
  if (!best) throw new Error("canonicalize() needs at least one posting");

  const withDescription = ranked.find((p) => p.description);
  const ats = ranked.find((p) => isAtsSource(p.source));
  const postedDates = ranked.flatMap((p) => (p.postedAt ? [p.postedAt.getTime()] : []));

  return {
    companyName: best.companyName,
    title: best.title,
    location: best.location,
    workplaceType: ranked.find((p) => p.workplaceType !== "UNKNOWN")?.workplaceType ?? "UNKNOWN",
    description: withDescription?.description ?? null,
    descriptionSource: withDescription?.source ?? null,
    applyUrl: ats?.url ?? ranked.find((p) => p.applyUrl)?.applyUrl ?? best.url,
    salary: ranked.find((p) => p.salary)?.salary ?? null,
    postedAt: postedDates.length > 0 ? new Date(Math.min(...postedDates)) : null,
  };
}
