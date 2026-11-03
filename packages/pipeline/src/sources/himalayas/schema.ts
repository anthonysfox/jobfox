import { z } from "zod";

// https://himalayas.app/api
// Loose objects keep fields we don't model, so the stored raw payload is complete.

export const himalayasJobSchema = z.looseObject({
  /** The job's Himalayas URL; also its stable ID. */
  guid: z.url(),
  title: z.string(),
  companyName: z.string(),
  /** "Full Time", "Part Time", "Contractor", "Temporary", "Intern", "Volunteer", or "Other". */
  employmentType: z.string().nullish(),
  /** Countries candidates must be in. Empty means anywhere. */
  locationRestrictions: z.array(z.string()).nullish(),
  description: z.string().default(""),
  /** Unix seconds. */
  pubDate: z.number(),
  expiryDate: z.number().nullish(),
  /** Their terms: use this, unchanged, for every Apply button. */
  applicationLink: z.url(),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  /** "annual", "monthly", "hourly"... */
  salaryPeriod: z.string().nullish(),
  currency: z.string().nullish(),
});

export const himalayasSearchResponseSchema = z.looseObject({
  totalCount: z.number(),
  jobs: z.array(himalayasJobSchema),
});

export type HimalayasJob = z.output<typeof himalayasJobSchema>;
