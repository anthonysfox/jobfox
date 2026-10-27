import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { JobfoxConfig } from "../core/config.ts";
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
    // messages.create rather than messages.parse: parse() throws on a truncated
    // response, and stop_reason has to be checked before the output is trusted.
    const response = await client.messages.create({
      model: config.model,
      // Thinking is on by default and counts toward this limit, so leave headroom.
      max_tokens: 8000,
      output_config: { effort: config.effort, format: zodOutputFormat(fitSchema) },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildJobMessage(job) }],
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        reason: `refused (${response.stop_details?.category ?? "no category"})`,
        usage: response.usage,
      };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "hit max_tokens", usage: response.usage };
    }
    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, reason: "output was not JSON", usage: response.usage };
    }
    const result = fitSchema.safeParse(json);
    if (!result.success) {
      return { ok: false, reason: "output did not match the schema", usage: response.usage };
    }
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
