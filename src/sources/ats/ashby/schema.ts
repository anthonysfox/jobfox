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
  apiVersion: z.string(),
  jobs: z.array(
    z.object({
      title: z.string(),
      location: z.string(),
      secondaryLocations: z.array(
        z.object({
          location: z.string(),
          address: z.object({
            addressLocality: z.string(),
            addressRegion: z.string(),
            addressCountry: z.string(),
          }),
        }),
      ),
      department: z.string(),
      team: z.string(),
      isListed: z.boolean(),
      isRemote: z.boolean(),
      workplaceType: z.string(),
      descriptionHtml: z.string(),
      descriptionPlain: z.string(),
      publishedAt: z.string(),
      employmentType: z.string(),
      address: z.object({
        postalAddress: z.object({
          addressLocality: z.string(),
          addressRegion: z.string(),
          addressCountry: z.string(),
        }),
      }),
      jobUrl: z.string(),
      applyUrl: z.string(),
    }),
  ),
  compensation: z.object({
    compensationTierSummary: z.string(),
    scrapeableCompensationSalarySummary: z.string(),
    compensationTiers: z.array(
      z.object({
        id: z.string(),
        tierSummary: z.string(),
        title: z.string(),
        additionalInformation: z.boolean(),
        components: z.array(
          z.object({
            id: z.string(),
            summary: z.string(),
            compensationType: z.string(),
            internval: z.string(),
            currencyCode: z.string() || z.null(),
            minValue: z.int(),
            maxValue: z.int(),
          }),
        ),
      }),
    ),
  }),
  summaryComponents: z.array(
    z.object({
      compensation: z.string(),
      interval: z.string(),
      currentCode: z.string() || z.null(),
      minValue: z.int(),
      maxValue: z.int(),
    }),
  ),
});

export type AshbyJob = z.output<typeof ashbyJobSchema>;
