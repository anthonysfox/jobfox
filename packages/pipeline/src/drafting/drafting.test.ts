import { describe, expect, it } from "vitest";
import { parseConfig } from "../core/config.ts";
import type { ScorableJob } from "../scoring/prompt.ts";
import { clientReturning } from "../test/fake-anthropic.ts";
import { bulletIssues, numbersIn } from "./checks.ts";
import { createDrafter } from "./drafter.ts";
import { buildDraftMessage, buildDraftSystemPrompt } from "./prompt.ts";
import { parseQuestions } from "./run.ts";

const config = parseConfig({ adzuna: { searches: [{ what: "x" }] }, filters: {} }).drafting;

const resume = `# Sam Doe
## Experience
- Rebuilt the **camera dashboard** in React and TypeScript, cutting load time by 40%.
- Built a Node.js API on AWS Lambda serving 1,200 customers.`;

const job: ScorableJob = {
  companyName: "Acme",
  title: "Full Stack Engineer",
  location: "New York, NY",
  workplaceType: "HYBRID",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  description: "React, TypeScript, AWS.",
  descriptionSource: "GREENHOUSE",
};

describe("bulletIssues", () => {
  it("accepts a rewrite whose source is in the resume, ignoring Markdown and punctuation", () => {
    const bullet = {
      text: "Cut dashboard load time 40% by rebuilding it in React and TypeScript.",
      source: "Rebuilt the camera dashboard in React and TypeScript, cutting load time by 40%",
    };
    expect(bulletIssues(bullet, resume)).toEqual([]);
  });

  it("flags a source line that isn't in the resume", () => {
    const bullet = { text: "Led a team.", source: "Led a team of five engineers." };
    expect(bulletIssues(bullet, resume)).toEqual(["The source line isn't in your resume."]);
  });

  it("flags numbers that appear nowhere in the resume", () => {
    const bullet = {
      text: "Served 5,000 customers with a Node.js API, cutting load time by 40%.",
      source: "Built a Node.js API on AWS Lambda serving 1,200 customers.",
    };
    expect(bulletIssues(bullet, resume)).toEqual(["Numbers not in your resume: 5000."]);
  });

  it("reads numbers with separators and decimals", () => {
    expect(numbersIn("1,200 users, 99.9% uptime, $3")).toEqual(["1200", "99.9", "3"]);
  });
});

describe("parseQuestions", () => {
  it("takes one question per line and drops blanks", () => {
    expect(parseQuestions("  Why us?\n\nWhat's your stack?  \n")).toEqual([
      "Why us?",
      "What's your stack?",
    ]);
  });

  it("caps the number of questions", () => {
    expect(parseQuestions(Array.from({ length: 20 }, (_, i) => `Q${i}`).join("\n"))).toHaveLength(
      10,
    );
  });
});

describe("prompts", () => {
  it("puts the resume in the system prompt", () => {
    expect(buildDraftSystemPrompt(resume)).toContain(`<resume>\n${resume}\n</resume>`);
  });

  it("includes the job, the fit assessment, and numbered questions", () => {
    const message = buildDraftMessage(job, ["Why us?", "Biggest project?"], {
      strengths: ["React rebuild"],
      gaps: [],
    });
    expect(message).toContain("Title: Full Stack Engineer");
    expect(message).toContain("Strengths:\n- React rebuild\nGaps:\n(none)");
    expect(message).toContain("<questions>\n1. Why us?\n2. Biggest project?\n</questions>");
  });

  it("leaves the fit assessment out for unscored jobs", () => {
    expect(buildDraftMessage(job, ["Why us?"], undefined)).not.toContain("fit_assessment");
  });
});

describe("createDrafter", () => {
  const output = {
    bullets: [
      {
        text: "  Cut dashboard load time by 40% with a React and TypeScript rebuild. ",
        source: "Rebuilt the camera dashboard in React and TypeScript, cutting load time by 40%.",
      },
      { text: "Mentored 12 engineers.", source: "Mentored engineers." },
    ],
    answers: [{ question: "Why do you want this job (reworded)?", answer: " Because… " }],
  };

  it("sends a cached system prompt with structured output", async () => {
    const { client, requests } = clientReturning({
      content: [{ type: "text", text: JSON.stringify(output) }],
      stop_reason: "end_turn",
    });
    await createDrafter({ client, resume, systemPrompt: "SYSTEM", config })(job, ["Why?"]);

    expect(requests[0]).toMatchObject({
      model: "claude-sonnet-5-5",
      system: [{ type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema" } },
    });
  });

  it("checks each bullet and aligns answers to the questions asked", async () => {
    const { client } = clientReturning({
      content: [{ type: "text", text: JSON.stringify(output) }],
      stop_reason: "end_turn",
    });
    const outcome = await createDrafter({ client, resume, systemPrompt: "SYSTEM", config })(job, [
      "Why do you want this job?",
      "What's your notice period?",
    ]);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.draft.bullets[0]).toMatchObject({
      text: "Cut dashboard load time by 40% with a React and TypeScript rebuild.",
      issues: [],
    });
    expect(outcome.draft.bullets[1]?.issues).toEqual([
      "The source line isn't in your resume.",
      "Numbers not in your resume: 12.",
    ]);
    // The model answered one of two questions; the second stays empty rather than shifting.
    expect(outcome.draft.answers).toEqual(["Because…", ""]);
  });

  it("reports truncated responses", async () => {
    const { client } = clientReturning({
      content: [{ type: "text", text: '{"bullets": [' }],
      stop_reason: "max_tokens",
    });
    const outcome = await createDrafter({ client, resume, systemPrompt: "SYSTEM", config })(
      job,
      [],
    );
    expect(outcome).toMatchObject({ ok: false, reason: "hit max_tokens" });
  });
});
