import type Anthropic from "@anthropic-ai/sdk";

/** USD per million tokens, for prompts under 100K tokens. Check current pricing before budgeting on these. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

// Relative to the input price.
const CACHE_READ = 0.1;
const CACHE_WRITE_5M = 1.25;

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function emptyUsage(): UsageTotals {
  return { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

export function addUsage(totals: UsageTotals, usage: Anthropic.Usage): void {
  totals.requests++;
  totals.inputTokens += usage.input_tokens;
  totals.outputTokens += usage.output_tokens;
  totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
  totals.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
}

/** Estimated cost in USD, or null for a model without a price entry. */
export function estimateCost(model: string, totals: UsageTotals): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const input =
    totals.inputTokens +
    totals.cacheReadTokens * CACHE_READ +
    totals.cacheWriteTokens * CACHE_WRITE_5M;
  return (input * price.input + totals.outputTokens * price.output) / 1_000_000;
}
