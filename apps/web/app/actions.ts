"use server";

import Anthropic from "@anthropic-ai/sdk";
import { draftForJob, parseQuestions } from "@jobfox/pipeline/drafting/run";
import { readResume } from "@jobfox/pipeline/scoring/context";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { config, RESUME_FILE } from "@/lib/queries";

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
