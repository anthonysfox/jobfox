import { z } from "zod";

/*
 * TODO(you): model the Greenhouse Job Board API responses.
 * Docs: https://developers.greenhouse.io/job-board.html
 *
 * Model only the fields toJob() needs and use z.looseObject so the raw
 * payload keeps the rest. See src/sources/adzuna/schema.ts for the pattern,
 * and fixtures/ for what real responses look like.
 */

export const greenhouseJobSchema = z.looseObject({
  // TODO: id, title, absolute_url, location.name, content, first_published, updated_at
});

export const greenhouseJobsResponseSchema = z.looseObject({
  // TODO: jobs (array of greenhouseJobSchema)
});

export type GreenhouseJob = z.output<typeof greenhouseJobSchema>;
