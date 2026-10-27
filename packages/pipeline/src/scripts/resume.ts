import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import { storedBulletsSchema } from "../drafting/drafter.ts";
import { createDb } from "../lib/db.ts";
import { renderResumePdf } from "../resume/render.ts";
import { contactFromEnv, resumeFileName, tailorResume } from "../resume/tailor.ts";
import { readResume } from "../scoring/context.ts";

/*
 * Write a tailored resume PDF for one job from its latest draft. No model
 * call: the draft already has the bullets. Run `pnpm draft <job id>` first.
 *
 *   pnpm resume <job id>     # writes data/resumes/<Name>_Resume_<Company>.pdf
 */

const OUT_DIR = "data/resumes";

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  parseConfig(userConfig);
  const [jobId] = process.argv.slice(2);
  if (!jobId) throw new Error("Usage: pnpm resume <job id>");
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
    const tailored = tailorResume({
      resume,
      bullets: storedBulletsSchema.parse(draft.bullets),
      posting: job.description ?? "",
      contact: contactFromEnv(env),
    });
    const file = path.join(OUT_DIR, resumeFileName(resume, job.company.name));
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(file, await renderResumePdf(tailored.markdown));
    console.log(`Wrote ${file} (${tailored.replaced} tailored bullets).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
