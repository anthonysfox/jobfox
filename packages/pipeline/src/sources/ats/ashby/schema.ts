import { z } from "zod";

// https://developers.ashbyhq.com/docs/public-job-posting-api
// Loose objects keep fields we don't model, so the stored raw payload is complete.

const compensationComponentSchema = z.looseObject({
  compensationType: z.string(),
  // Missing entirely on non-cash components such as equity.
  currencyCode: z.string().nullish(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
});

export const ashbyJobSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  /** "OnSite", "Hybrid", or "Remote". */
  workplaceType: z.string().nullish(),
  isListed: z.boolean(),
  publishedAt: z.iso.datetime({ offset: true }),
  jobUrl: z.url(),
  applyUrl: z.url(),
  descriptionPlain: z.string().nullish(),
  compensation: z
    .looseObject({ summaryComponents: z.array(compensationComponentSchema).default([]) })
    .nullish(),
});

export const ashbyJobBoardResponseSchema = z.looseObject({
  jobs: z.array(ashbyJobSchema),
});

export type AshbyJob = z.output<typeof ashbyJobSchema>;
