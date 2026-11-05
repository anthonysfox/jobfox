import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import { storedBulletsSchema, storedSummarySchema } from "../drafting/drafter.ts";
import { createDb } from "../lib/db.ts";
import { buildTailoredResume } from "../resume/build.ts";
import { contactFromEnv, resumeFileName } from "../resume/tailor.ts";
import { readResume } from "../scoring/context.ts";

/*
 * Write a tailored resume PDF for one job from its latest draft. No model
 * call: the draft already has the bullets. Run `pnpm draft <job id>` first.
 * Without a job, write the master resume as it is, for anything not tied to a posting.
 *
 *   pnpm resume <job id>     # writes data/resumes/<Name>_Resume_<Company>.pdf
 *   pnpm resume              # writes data/resumes/<Name>_Resume.pdf
 */

const OUT_DIR = "data/resumes";

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  parseConfig(userConfig);
  const [jobId] = process.argv.slice(2);
  if (!jobId) return writeMaster(contactFromEnv(env));
  const db = createDb();

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { company: true, drafts: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!job) throw new Error("Job not found.");
    const [draft] = job.drafts;
    if (!draft) throw new Error(`No draft for this job yet. Run pnpm draft ${jobId} first.`);

    const resume = readResume();
    const tailored = await buildTailoredResume({
      resume,
      bullets: storedBulletsSchema.parse(draft.bullets),
      summary: storedSummarySchema.nullable().parse(draft.summary),
      posting: job.description ?? "",
      contact: contactFromEnv(env),
    });
    const file = path.join(OUT_DIR, resumeFileName(resume, job.title, job.company.name));
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(file, tailored.pdf);
    console.log(
      `Wrote ${file}: ${tailored.summarized ? "tailored summary, " : ""}${tailored.replaced} rewritten bullets, ${tailored.added} new, ${tailored.pages} page(s), spacing at ${Math.round(tailored.spacing * 100)}%.`,
    );
  } finally {
    await db.$disconnect();
  }
}

/** The master resume, untailored: same layout and page fit, contact details added. */
async function writeMaster(contact: ReturnType<typeof contactFromEnv>): Promise<void> {
  const resume = readResume();
  const built = await buildTailoredResume({ resume, bullets: [], posting: "", contact });
  const file = path.join(OUT_DIR, resumeFileName(resume, "", ""));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(file, built.pdf);
  console.log(
    `Wrote ${file}: master resume, ${built.pages} page(s), spacing at ${Math.round(built.spacing * 100)}%.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
