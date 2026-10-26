/**
 * Domain types shared by every source. Deliberately independent of Prisma:
 * the persistence layer maps these to rows, and TypeScript checks that the
 * string unions stay assignable to the generated enums.
 */

export type Source = "ADZUNA" | "HN_HIRING" | "GREENHOUSE" | "LEVER" | "ASHBY";

export type WorkplaceType = "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN";

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

/** A job as reported by a single source, before dedupe. Becomes one JobPosting row. */
export interface Job {
  source: Source;
  /** Stable ID within the source, used for idempotent upserts. */
  externalId: string;
  /** Where the source shows the job. May be a tracking redirect (Adzuna). */
  url: string;
  /** Direct employer or ATS link, when the source exposes one. */
  applyUrl: string | null;
  title: string;
  companyName: string;
  location: string | null;
  workplaceType: WorkplaceType;
  description: string | null;
  descriptionTruncated: boolean;
  salary: Salary | null;
  postedAt: Date | null;
  /** Original payload, stored for debugging and re-parsing later. */
  raw: unknown;
}

/** Title for a posting that never names a role. Filters treat it as unknown, not a mismatch. */
export const UNKNOWN_TITLE = "(role not stated)";

/** ATS sources outrank aggregators when choosing which description to keep. */
export const SOURCE_PRIORITY: Record<Source, number> = {
  GREENHOUSE: 3,
  LEVER: 3,
  ASHBY: 3,
  HN_HIRING: 2,
  ADZUNA: 1,
};
