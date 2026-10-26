import { z } from "zod";

// https://github.com/lever/postings-api
// Loose objects keep fields we don't model, so the stored raw payload is complete.

export const leverPostingSchema = z.looseObject({
  id: z.string(),
  /** The job title. */
  text: z.string(),
  categories: z.looseObject({ location: z.string().optional() }),
  /** "onsite", "hybrid", "remote", or "unspecified". */
  workplaceType: z.string().optional(),
  /** Epoch milliseconds. */
  createdAt: z.number(),
  hostedUrl: z.url(),
  applyUrl: z.url(),
  descriptionPlain: z.string().default(""),
  lists: z.array(z.looseObject({ text: z.string(), content: z.string() })).default([]),
  additionalPlain: z.string().default(""),
  salaryRange: z.looseObject({ min: z.number(), max: z.number(), currency: z.string() }).nullish(),
});

// The list endpoint returns a bare array, not an object.
export const leverPostingsResponseSchema = z.array(leverPostingSchema);

export type LeverPosting = z.output<typeof leverPostingSchema>;
