import { z } from "zod";

/*
 * TODO(you): model the Lever Postings API responses.
 * Docs: https://github.com/lever/postings-api
 *
 * Model only the fields toJob() needs and use z.looseObject so the raw
 * payload keeps the rest. See src/sources/adzuna/schema.ts for the pattern,
 * and fixtures/ for what real responses look like.
 */

export const leverPostingSchema = z.looseObject({
  // TODO: id, text (the title), categories.location, workplaceType, createdAt,
  // hostedUrl, applyUrl, descriptionPlain, lists, additionalPlain, salaryRange
});

// The list endpoint returns a bare array, not an object.
export const leverPostingsResponseSchema = z.array(leverPostingSchema);

export type LeverPosting = z.output<typeof leverPostingSchema>;
