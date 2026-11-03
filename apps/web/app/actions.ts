"use server";

import Anthropic from "@anthropic-ai/sdk";
import { draftForJob, parseQuestions } from "@jobfox/pipeline/drafting/run";
import { pastedJobSchema, savePastedJob } from "@jobfox/pipeline/pipeline/manual";
import {
  loadScoringContext,
  readProfile,
  readResume,
  readVoice,
} from "@jobfox/pipeline/scoring/context";
import { createLocalEmbedder, type Embedder } from "@jobfox/pipeline/scoring/embed";
import { scoreJobs } from "@jobfox/pipeline/scoring/run";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { config, PREFERENCES_FILE, PROFILE_FILE, RESUME_FILE, VOICE_FILE } from "@/lib/queries";

// Server actions are POST endpoints, even on localhost, so validate what comes in.
const jobId = z.string().min(1).max(64);
const status = z.enum(["NEW", "SAVED", "APPLIED", "SKIPPED"]);
const verdict = z.enum(["STRONG", "POSSIBLE", "WEAK"]);

export async function setStatus(id: string, next: string): Promise<void> {
  await db.job.update({
    where: { id: jobId.parse(id) },
    data: { status: status.parse(next), statusChangedAt: new Date() },
  });
  refresh();
}

export async function saveLabel(id: string, label: string, formData: FormData): Promise<void> {
  const note = z
    .string()
    .max(2000)
    .optional()
    .parse(formData.get("note") ?? undefined)
    ?.trim();
  const data = { label: verdict.parse(label), note: note || null };
  await db.jobLabel.upsert({
    where: { jobId: jobId.parse(id) },
    create: { jobId: id, ...data },
    update: data,
  });
  refresh();
}

export interface DraftState {
  error?: string;
}

/** Calls Claude, so it takes a few seconds; the form shows its pending state meanwhile. */
export async function generateDraft(
  id: string,
  _previous: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const questions = parseQuestions(
    z
      .string()
      .max(10_000)
      .parse(formData.get("questions") ?? ""),
  );
  try {
    const result = await draftForJob({
      db,
      client: new Anthropic(),
      config,
      resume: readResume(RESUME_FILE),
      profile: readProfile(PROFILE_FILE),
      voice: readVoice(VOICE_FILE),
      jobId: jobId.parse(id),
      questions,
    });
    if (!result.ok) return { error: `Couldn't draft: ${result.reason}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Drafting failed." };
  }
  refresh();
  return {};
}

// The model takes a few seconds to load, so load it once per server process.
let embedder: Promise<Embedder> | undefined;

/** Scores one job the same way pnpm score does. Returns why it failed, if it did. */
async function scoreJob(client: Anthropic, id: string): Promise<string | null> {
  const job = await db.job.findUniqueOrThrow({
    where: { id },
    include: { company: true, scores: true, label: true },
  });
  embedder ??= createLocalEmbedder();
  const result = await scoreJobs({
    db,
    client,
    embedder: await embedder,
    config,
    context: loadScoringContext(config, { resume: RESUME_FILE, preferences: PREFERENCES_FILE }),
    jobs: [job],
    alwaysInclude: new Set([id]),
  });
  return result.failures[0] ?? null;
}

export interface PasteState {
  error?: string;
  /** Set once the job is saved, so the form can link to it if a later step failed. */
  jobId?: string;
  /** What was submitted. React resets the form after an action, so it refills from these. */
  values?: Record<string, string>;
}

const PASTE_FIELDS = ["company", "title", "location", "url", "description", "questions"] as const;

/**
 * Saves a pasted posting, then scores and drafts it like a discovered job. The
 * score's strengths and gaps feed the draft, so scoring goes first; a failed
 * score still drafts, since the draft works without them.
 */
export async function addPastedJob(_previous: PasteState, formData: FormData): Promise<PasteState> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const values = Object.fromEntries(PASTE_FIELDS.map((name) => [name, field(name) ?? ""]));
  const input = pastedJobSchema.safeParse({
    companyName: field("company"),
    title: field("title"),
    location: field("location"),
    url: field("url"),
    description: field("description"),
  });
  if (!input.success) {
    return { values, error: input.error.issues[0]?.message ?? "Check the form." };
  }
  const questions = parseQuestions(
    z
      .string()
      .max(10_000)
      .parse(field("questions") ?? ""),
  );

  const id = await savePastedJob(db, input.data);
  const client = new Anthropic();
  try {
    const scoreError = await scoreJob(client, id).catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    );
    const result = await draftForJob({
      db,
      client,
      config,
      resume: readResume(RESUME_FILE),
      profile: readProfile(PROFILE_FILE),
      voice: readVoice(VOICE_FILE),
      jobId: id,
      questions,
    });
    if (!result.ok) {
      return { jobId: id, values, error: `Saved the job, but couldn't draft: ${result.reason}.` };
    }
    if (scoreError) {
      return { jobId: id, values, error: `Drafted, but scoring failed: ${scoreError}` };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "drafting failed";
    return { jobId: id, values, error: `Saved the job, but couldn't draft: ${reason}` };
  }
  // Outside the try: redirect works by throwing.
  redirect(`/jobs/${id}`);
}
