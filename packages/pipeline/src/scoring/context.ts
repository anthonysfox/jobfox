import { existsSync, readFileSync } from "node:fs";
import type { JobfoxConfig } from "../core/config.ts";
import { resumeHash } from "./embed.ts";
import { buildSystemPrompt } from "./prompt.ts";

export const RESUME_PATH = "data/resume.md";
/** Optional: more detail than the resume holds, with accuracy notes. Used for drafting only. */
export const PROFILE_PATH = "data/profile.md";
/** Optional: how I write, so drafted messages sound like me. Used for drafting only. */
export const VOICE_PATH = "data/voice.md";
/** Optional: my real scoring preferences, kept out of the repo because they include pay. */
export const PREFERENCES_PATH = "data/preferences.md";

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

export function readVoice(path = VOICE_PATH): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** data/preferences.md when it exists, otherwise the example in jobfox.config.ts. */
export function readPreferences(fallback: string, path = PREFERENCES_PATH): string {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

/** Paths default to the pipeline folder; the dashboard runs elsewhere and passes its own. */
export function loadScoringContext(
  config: JobfoxConfig,
  paths: { resume?: string; preferences?: string } = {},
): ScoringContext {
  const resume = readResume(paths.resume);
  const systemPrompt = buildSystemPrompt(
    resume,
    readPreferences(config.scoring.preferences, paths.preferences),
  );
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
