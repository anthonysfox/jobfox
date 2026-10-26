import { z } from "zod";

// https://hn.algolia.com/api

export const storySearchSchema = z.looseObject({
  hits: z.array(
    z.looseObject({
      objectID: z.string(),
      title: z.string().nullish(),
      created_at: z.iso.datetime({ offset: true }),
    }),
  ),
});

export const commentSchema = z.looseObject({
  id: z.number(),
  author: z.string().nullable(),
  // Null for deleted or flagged comments.
  text: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export const threadSchema = z.looseObject({
  id: z.number(),
  title: z.string(),
  // Only top-level comments are job posts; nested replies are ignored.
  children: z.array(commentSchema),
});

export type HnComment = z.output<typeof commentSchema>;
export type HnThread = z.output<typeof threadSchema>;
