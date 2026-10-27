import { existsSync, readFileSync } from "node:fs";
import type { JobfoxConfig } from "../core/config.ts";
import { resumeHash } from "./embed.ts";
import { buildSystemPrompt } from "./prompt.ts";

export const RESUME_PATH = "data/resume.md";
/** Optional: more detail than the resume holds, with accuracy notes. Used for drafting only. */
export const PROFILE_PATH = "data/profile.md";

export interface ScoringContext {
  resume: string;
  systemPrompt: string;
  /** Hash of the whole system prompt, so editing the resume, preferences, or rubric re-scores. */
  promptHash: string;
  model: string;
}

export function readResume(path = RESUME_PATH): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(`Put your resume in ${path} (Markdown or plain text).`);
  }
}

export function readProfile(path = PROFILE_PATH): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export function loadScoringContext(config: JobfoxConfig): ScoringContext {
  const resume = readResume();
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
