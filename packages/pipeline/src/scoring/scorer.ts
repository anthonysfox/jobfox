import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { JobfoxConfig } from "../core/config.ts";
import { readStructured } from "../lib/structured.ts";
import { buildJobMessage, type ScorableJob } from "./prompt.ts";

export const fitSchema = z.object({
  fitScore: z.number().int(),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export type Verdict = "STRONG" | "POSSIBLE" | "WEAK";

export interface Fit {
  fitScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export type ScoreOutcome =
  | { ok: true; fit: Fit; usage: Anthropic.Usage }
  | { ok: false; reason: string; usage: Anthropic.Usage | null };

type ScoringConfig = JobfoxConfig["scoring"];

/**
 * The verdict comes from the score and my thresholds at read time, so retuning
 * the thresholds re-sorts existing scores without calling the model again.
 */
export function toVerdict(
  fitScore: number,
  config: Pick<ScoringConfig, "strongThreshold" | "possibleThreshold">,
): Verdict {
  if (fitScore >= config.strongThreshold) return "STRONG";
  if (fitScore >= config.possibleThreshold) return "POSSIBLE";
  return "WEAK";
}

export interface ScorerOptions {
  client: Anthropic;
  systemPrompt: string;
  config: ScoringConfig;
}

export function createScorer({ client, systemPrompt, config }: ScorerOptions) {
  return async function score(job: ScorableJob): Promise<ScoreOutcome> {
    const response = await client.messages.create({
      model: config.model,
      // Thinking is on by default and counts toward this limit, so leave headroom.
      max_tokens: 8000,
      output_config: { effort: config.effort, format: zodOutputFormat(fitSchema) },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildJobMessage(job) }],
    });

    const result = readStructured(response, fitSchema);
    if (!result.ok) return { ok: false, reason: result.reason, usage: response.usage };
    const parsed = result.data;

    const fitScore = Math.min(100, Math.max(0, Math.round(parsed.fitScore)));
    return {
      ok: true,
      fit: {
        fitScore,
        summary: parsed.summary.trim(),
        strengths: parsed.strengths.slice(0, 4),
        gaps: parsed.gaps.slice(0, 4),
      },
      usage: response.usage,
    };
  };
}
