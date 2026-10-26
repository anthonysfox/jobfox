import { z } from "zod";

// https://developers.greenhouse.io/job-board.html
// Loose objects keep fields we don't model, so the stored raw payload is complete.

export const greenhouseJobSchema = z.looseObject({
  id: z.number(),
  title: z.string(),
  absolute_url: z.url(),
  location: z.looseObject({ name: z.string() }).nullish(),
  /** HTML that has itself been entity-escaped: "&lt;p&gt;…". Only present with ?content=true. */
  content: z.string().default(""),
  first_published: z.iso.datetime({ offset: true }).nullish(),
  updated_at: z.iso.datetime({ offset: true }),
});

export const greenhouseJobsResponseSchema = z.looseObject({
  jobs: z.array(greenhouseJobSchema),
});

export type GreenhouseJob = z.output<typeof greenhouseJobSchema>;
