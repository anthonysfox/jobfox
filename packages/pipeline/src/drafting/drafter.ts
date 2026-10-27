import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { JobfoxConfig } from "../core/config.ts";
import { readStructured } from "../lib/structured.ts";
import type { ScorableJob } from "../scoring/prompt.ts";
import { bulletIssues } from "./checks.ts";
import { buildDraftMessage, type FitNotes } from "./prompt.ts";

export const draftSchema = z.object({
  bullets: z.array(z.object({ text: z.string(), source: z.string() })),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});

/** How bullets are stored in ApplicationDraft.bullets; also used to read them back. */
export const storedBulletsSchema = z.array(
  z.object({ text: z.string(), source: z.string(), issues: z.array(z.string()) }),
);
export type DraftBullet = z.output<typeof storedBulletsSchema>[number];

export interface Draft {
  bullets: DraftBullet[];
  /** One per question, in the order asked. */
  answers: string[];
}

export type DraftOutcome =
  | { ok: true; draft: Draft; usage: Anthropic.Usage }
  | { ok: false; reason: string; usage: Anthropic.Usage | null };

export interface DrafterOptions {
  client: Anthropic;
  resume: string;
  systemPrompt: string;
  config: JobfoxConfig["drafting"];
}

export function createDrafter({ client, resume, systemPrompt, config }: DrafterOptions) {
  return async function draft(
    job: ScorableJob,
    questions: string[],
    fit?: FitNotes,
  ): Promise<DraftOutcome> {
    const response = await client.messages.create({
      model: config.model,
      // Thinking is on by default and counts toward this limit, so leave headroom.
      max_tokens: 16000,
      output_config: { effort: config.effort, format: zodOutputFormat(draftSchema) },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildDraftMessage(job, questions, fit) }],
    });

    const result = readStructured(response, draftSchema);
    if (!result.ok) return { ok: false, reason: result.reason, usage: response.usage };

    return {
      ok: true,
      draft: {
        bullets: result.data.bullets.slice(0, 6).map((b) => ({
          text: b.text.trim(),
          source: b.source.trim(),
          issues: bulletIssues(b, resume),
        })),
        // Keyed to my questions by position, so a reworded echo can't misalign them.
        answers: questions.map((_, i) => result.data.answers[i]?.answer.trim() ?? ""),
      },
      usage: response.usage,
    };
  };
}
