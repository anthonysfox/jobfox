import { z } from "zod";
import type { Job } from "../core/job.ts";
import type { PrismaClient } from "../lib/db.ts";
import { dedupeKey, inferEmploymentType, inferWorkplaceType } from "../lib/normalize.ts";
import { persistGroup } from "./persist.ts";

const optionalText = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => v || undefined);

/** What I paste into the dashboard. Only the description is long. */
export const pastedJobSchema = z.object({
  companyName: z.string().trim().min(1, "Add the company name.").max(200),
  title: z.string().trim().min(1, "Add the job title.").max(300),
  location: optionalText,
  url: z
    .union([z.url("That link doesn't look like a URL."), z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  description: z
    .string()
    .trim()
    .min(200, "Paste the whole job description; that looks too short.")
    .max(50_000),
});

export type PastedJob = z.output<typeof pastedJobSchema>;

/**
 * A pasted posting as a Job. Its ID is the dedupe key, so pasting the same
 * job again updates it instead of adding a copy, and a job discovery already
 * found merges with it.
 */
export function pastedJob(input: PastedJob, now = new Date()): Job {
  const location = input.location ?? null;
  const base = { companyName: input.companyName, title: input.title, location };
  return {
    ...base,
    source: "MANUAL",
    externalId: dedupeKey(base),
    url: input.url ?? "",
    applyUrl: input.url ?? null,
    workplaceType: inferWorkplaceType(input.title, location, input.description),
    employmentType: inferEmploymentType({ title: input.title, description: input.description }),
    description: input.description,
    descriptionTruncated: false,
    salary: null,
    postedAt: now,
    raw: input,
  };
}

/**
 * Saves a pasted job and returns its ID. No filters: I picked it myself, so it
 * shouldn't be hidden for its title or location.
 */
export async function savePastedJob(db: PrismaClient, input: PastedJob): Promise<string> {
  const job = pastedJob(input);
  const result = await persistGroup(
    db,
    { key: job.externalId, postings: [job] },
    { board: null, filter: () => [] },
  );
  return result.jobId;
}
