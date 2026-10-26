"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

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
