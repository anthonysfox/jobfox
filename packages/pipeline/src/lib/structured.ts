import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export type StructuredResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/**
 * Validates a structured-output response. Used with messages.create rather than
 * messages.parse: parse() throws on a truncated response, and stop_reason has to
 * be checked before the output is trusted.
 */
export function readStructured<S extends z.ZodType>(
  response: Anthropic.Message,
  schema: S,
): StructuredResult<z.output<S>> {
  if (response.stop_reason === "refusal") {
    return { ok: false, reason: `refused (${response.stop_details?.category ?? "no category"})` };
  }
  if (response.stop_reason === "max_tokens") {
    return { ok: false, reason: "hit max_tokens" };
  }
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "output was not JSON" };
  }
  const result = schema.safeParse(json);
  if (!result.success) return { ok: false, reason: "output did not match the schema" };
  return { ok: true, data: result.data };
}
