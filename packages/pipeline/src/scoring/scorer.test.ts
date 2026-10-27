import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../core/config.ts";
import { addUsage, emptyUsage, estimateCost } from "./cost.ts";
import {
  buildJobMessage,
  buildSystemPrompt,
  MAX_DESCRIPTION_CHARS,
  type ScorableJob,
} from "./prompt.ts";
import { createScorer, toVerdict } from "./scorer.ts";

const config = parseConfig({ adzuna: { searches: [{ what: "x" }] }, filters: {} }).scoring;

const job: ScorableJob = {
  companyName: "Acme",
  title: "Full Stack Engineer",
  location: "New York, NY",
  workplaceType: "HYBRID",
  salaryMin: 140000,
  salaryMax: 180000,
  salaryCurrency: "USD",
  description: "We use React, TypeScript, and Postgres.",
  descriptionSource: "GREENHOUSE",
};

/**
 * A real Anthropic client whose fetch returns a canned Messages API response,
 * so the test exercises the SDK's own request building and output parsing.
 */
function clientReturning(message: Record<string, unknown>) {
  const requests: Record<string, unknown>[] = [];
  const client = new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: (_url, init) => {
      requests.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: config.model,
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 400,
              output_tokens: 300,
              cache_read_input_tokens: 1500,
              cache_creation_input_tokens: 0,
            },
            ...message,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    },
  });
  return { client, requests };
}

const fitJson = JSON.stringify({
  fitScore: 82,
  summary: "Strong React/TypeScript match with a hybrid NYC setup.",
  strengths: [
    "React + TypeScript rewrite at EarthCam",
    "Postgres with Prisma",
    "AWS SA",
    "MCP server",
    "extra",
  ],
  gaps: ["No Kubernetes"],
});

describe("createScorer", () => {
  it("sends a cached system prompt, the configured effort, and structured output", async () => {
    const { client, requests } = clientReturning({
      content: [{ type: "text", text: fitJson }],
      stop_reason: "end_turn",
    });
    await createScorer({ client, systemPrompt: "SYSTEM", config })(job);

    const body = requests[0];
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      system: [{ type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema" } },
    });
    // Haiku 5.5 rejects sampling parameters.
    expect(body).not.toHaveProperty("temperature");
  });

  it("returns the parsed fit", async () => {
    const { client } = clientReturning({
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: fitJson },
      ],
      stop_reason: "end_turn",
    });
    const outcome = await createScorer({ client, systemPrompt: "SYSTEM", config })(job);

    expect(outcome).toMatchObject({
      ok: true,
      fit: { fitScore: 82, gaps: ["No Kubernetes"] },
    });
    // At most four strengths are kept.
    expect(outcome.ok && outcome.fit.strengths).toHaveLength(4);
  });

  it("reports refusals without throwing", async () => {
    const { client } = clientReturning({
      content: [],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: null, explanation: null },
    });
    const outcome = await createScorer({ client, systemPrompt: "SYSTEM", config })(job);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.reason).toContain("refused");
  });

  it("reports truncated responses", async () => {
    const { client } = clientReturning({
      content: [{ type: "text", text: '{"fitScore": 8' }],
      stop_reason: "max_tokens",
    });
    const outcome = await createScorer({ client, systemPrompt: "SYSTEM", config })(job);
    expect(outcome).toMatchObject({ ok: false, reason: "hit max_tokens" });
  });

  it("rejects output that doesn't match the schema", async () => {
    const { client } = clientReturning({
      content: [{ type: "text", text: JSON.stringify({ fitScore: "high" }) }],
      stop_reason: "end_turn",
    });
    const outcome = await createScorer({ client, systemPrompt: "SYSTEM", config })(job);
    expect(outcome).toMatchObject({ ok: false, reason: "output did not match the schema" });
  });

  it("clamps out-of-range scores", async () => {
    const { client } = clientReturning({
      content: [
        {
          type: "text",
          text: JSON.stringify({ fitScore: 140, summary: "x", strengths: [], gaps: [] }),
        },
      ],
      stop_reason: "end_turn",
    });
    const outcome = await createScorer({ client, systemPrompt: "SYSTEM", config })(job);
    expect(outcome.ok && outcome.fit.fitScore).toBe(100);
  });
});

describe("toVerdict", () => {
  it.each([
    [75, "STRONG"],
    [74, "POSSIBLE"],
    [50, "POSSIBLE"],
    [49, "WEAK"],
  ] as const)("%i -> %s", (score, verdict) => {
    expect(toVerdict(score, config)).toBe(verdict);
  });
});

describe("prompts", () => {
  it("puts resume and preferences in the system prompt", () => {
    const prompt = buildSystemPrompt("RESUME TEXT", "Remote US only");
    expect(prompt).toContain("<resume>\nRESUME TEXT\n</resume>");
    expect(prompt).toContain("Remote US only");
  });

  it("describes the job, including where the description came from", () => {
    const message = buildJobMessage(job);
    expect(message).toContain("Title: Full Stack Engineer");
    expect(message).toContain("Salary: 140,000 - 180,000 USD");
    expect(message).toContain("Source: Greenhouse (full posting)");
  });

  it("flags Adzuna snippets as partial", () => {
    expect(buildJobMessage({ ...job, descriptionSource: "ADZUNA" })).toContain("short snippet");
  });

  it("marks very long postings as truncated", () => {
    const message = buildJobMessage({
      ...job,
      description: "x".repeat(MAX_DESCRIPTION_CHARS + 10),
    });
    expect(message).toContain("[posting truncated]");
  });
});

describe("estimateCost", () => {
  it("prices cached input at a tenth of the input rate", () => {
    const totals = emptyUsage();
    addUsage(totals, {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    } as Anthropic.Usage);

    expect(estimateCost("claude-haiku-5-5", totals)).toBeCloseTo(0.1 + 0.01 + 0.5);
    expect(estimateCost("some-other-model", totals)).toBeNull();
  });
});
