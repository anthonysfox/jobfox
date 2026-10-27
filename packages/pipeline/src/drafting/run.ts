import type Anthropic from "@anthropic-ai/sdk";
import type { JobfoxConfig } from "../core/config.ts";
import type { PrismaClient } from "../lib/db.ts";
import { addUsage, emptyUsage, estimateCost } from "../scoring/cost.ts";
import { resumeHash } from "../scoring/embed.ts";
import { createDrafter } from "./drafter.ts";
import { buildDraftSystemPrompt } from "./prompt.ts";

export const MAX_QUESTIONS = 10;

/** One question per line; blank lines dropped. */
export function parseQuestions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);
}

export interface DraftForJobOptions {
  db: PrismaClient;
  client: Anthropic;
  config: JobfoxConfig;
  resume: string;
  jobId: string;
  questions: string[];
}

/** Drafts bullets and answers for one job and saves them as a new ApplicationDraft. */
export async function draftForJob({
  db,
  client,
  config,
  resume,
  jobId,
  questions,
}: DraftForJobOptions) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      company: true,
      scores: { where: { model: config.scoring.model }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!job) return { ok: false as const, reason: "job not found" };

  const systemPrompt = buildDraftSystemPrompt(resume);
  const draft = createDrafter({ client, resume, systemPrompt, config: config.drafting });
  const outcome = await draft({ ...job, companyName: job.company.name }, questions, job.scores[0]);

  const usage = emptyUsage();
  if (outcome.usage) addUsage(usage, outcome.usage);
  const costUsd = estimateCost(config.drafting.model, usage);
  if (!outcome.ok) return { ok: false as const, reason: outcome.reason };

  const saved = await db.applicationDraft.create({
    data: {
      jobId,
      model: config.drafting.model,
      promptHash: resumeHash(systemPrompt),
      questions,
      bullets: outcome.draft.bullets,
      answers: outcome.draft.answers,
      costUsd,
    },
  });
  return { ok: true as const, draft: saved };
}
