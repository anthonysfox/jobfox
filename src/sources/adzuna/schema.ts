import { z } from "zod";

// https://developer.adzuna.com/docs/search
// Loose objects keep fields we don't model, so the stored raw payload is complete.

export const adzunaJobSchema = z.looseObject({
  // Documented as a string, but accept numbers too.
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  description: z.string().default(""),
  created: z.iso.datetime({ offset: true }),
  redirect_url: z.url(),
  company: z.looseObject({ display_name: z.string().optional() }).optional(),
  location: z
    .looseObject({
      display_name: z.string().optional(),
      area: z.array(z.string()).optional(),
    })
    .optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  // "1" means Adzuna estimated the salary; the posting didn't state it.
  salary_is_predicted: z.union([z.string(), z.number()]).transform(String).optional(),
  contract_time: z.string().optional(),
});

export const adzunaSearchResponseSchema = z.looseObject({
  count: z.number(),
  results: z.array(adzunaJobSchema),
});

export type AdzunaJob = z.output<typeof adzunaJobSchema>;
export type AdzunaSearchResponse = z.output<typeof adzunaSearchResponseSchema>;
