import { readFileSync } from "node:fs";
import type { JobfoxConfig } from "../core/config.js";
import { resumeHash } from "./embed.js";
import { buildSystemPrompt } from "./prompt.js";

export const RESUME_PATH = "data/resume.md";

export interface ScoringContext {
  resume: string;
  systemPrompt: string;
  /** Hash of the whole system prompt, so editing the resume, preferences, or rubric re-scores. */
  promptHash: string;
  model: string;
}

export function loadScoringContext(config: JobfoxConfig): ScoringContext {
  let resume: string;
  try {
    resume = readFileSync(RESUME_PATH, "utf8");
  } catch {
    throw new Error(`Put your resume in ${RESUME_PATH} (Markdown or plain text).`);
  }
  const systemPrompt = buildSystemPrompt(resume, config.scoring.preferences);
  return {
    resume,
    systemPrompt,
    promptHash: resumeHash(systemPrompt),
    model: config.scoring.model,
  };
}

/** The score for the current prompt and model, if there is one. */
export function currentScore<T extends { resumeHash: string; model: string }>(
  scores: T[],
  context: Pick<ScoringContext, "promptHash" | "model">,
): T | undefined {
  return scores.find((s) => s.resumeHash === context.promptHash && s.model === context.model);
}
