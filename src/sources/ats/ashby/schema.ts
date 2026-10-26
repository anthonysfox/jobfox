import { z } from "zod";

/*
 * TODO(you): model the Ashby public job posting API response.
 * Docs: https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 * Model only the fields toJob() needs and use z.looseObject so the raw
 * payload keeps the rest. See src/sources/adzuna/schema.ts for the pattern,
 * and fixtures/ for what real responses look like.
 */

export const ashbyJobSchema = z.looseObject({
  // TODO: id, title, location, workplaceType, isRemote, isListed, publishedAt,
  // jobUrl, applyUrl, descriptionPlain, compensation.summaryComponents
});

export const ashbyJobBoardResponseSchema = z.looseObject({
  // TODO: jobs (array of ashbyJobSchema)
});

export type AshbyJob = z.output<typeof ashbyJobSchema>;
