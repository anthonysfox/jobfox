import type { FilterConfig } from "../core/config.js";
import type { PrismaClient } from "../lib/db.js";
import { rejectReasons } from "./filters.js";

/** Jobs not seen within this window have most likely been filled. */
export const STALE_AFTER_DAYS = 3;

/**
 * Jobs that pass the current filters and were seen recently. Filters are
 * re-applied from config rather than read from rejectedReasons, so config
 * changes take effect without fetching again.
 */
export async function findCurrentMatches(
  db: PrismaClient,
  filters: FilterConfig,
  now = new Date(),
) {
  const since = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await db.job.findMany({
    where: { lastSeenAt: { gte: since } },
    include: { company: true, scores: true, label: true },
    orderBy: { firstSeenAt: "desc" },
  });
  return jobs.filter(
    (job) => rejectReasons({ ...job, companyName: job.company.name }, filters).length === 0,
  );
}

export type MatchedJob = Awaited<ReturnType<typeof findCurrentMatches>>[number];
