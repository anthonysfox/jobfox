import Anthropic from "@anthropic-ai/sdk";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import { storedBulletsSchema, storedSummarySchema } from "../drafting/drafter.ts";
import { draftForJob } from "../drafting/run.ts";
import { createDb } from "../lib/db.ts";
import { readProfile, readResume } from "../scoring/context.ts";

/*
 * Draft tailored resume bullets and answers for one job. The dashboard's job
 * page does the same thing; this is for the terminal.
 *
 *   pnpm draft <job id>
 *   pnpm draft <job id> -q "Why do you want to work here?" -q "Describe a hard bug."
 */

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  if (!env.ANTHROPIC_API_KEY) throw new Error("Add ANTHROPIC_API_KEY to .env to draft.");
  const [jobId] = process.argv.slice(2);
  if (!jobId || jobId.startsWith("-")) throw new Error("Usage: pnpm draft <job id> [-q question]…");
  const config = parseConfig(userConfig);
  const asked = process.argv.flatMap((arg, i, argv) => (arg === "-q" ? (argv[i + 1] ?? []) : []));
  const questions = asked.length > 0 ? asked : config.drafting.defaultQuestions;
  const db = createDb();

  try {
    console.log(`Drafting with ${config.drafting.model}…`);
    const result = await draftForJob({
      db,
      client: new Anthropic(),
      config,
      resume: readResume(),
      profile: readProfile(),
      jobId,
      questions,
    });
    if (!result.ok) throw new Error(`Couldn't draft: ${result.reason}`);

    const summary = storedSummarySchema.nullable().parse(result.draft.summary);
    if (summary) {
      console.log(`\nSummary\n  ${summary.text}`);
      for (const issue of summary.issues) console.log(`    ! ${issue}`);
    }
    console.log("\nResume bullets");
    for (const bullet of storedBulletsSchema.parse(result.draft.bullets)) {
      console.log(`  ${bullet.entry ? `+ [${bullet.entry}]` : "-"} ${bullet.text}`);
      for (const issue of bullet.issues) console.log(`    ! ${issue}`);
    }
    result.draft.questions.forEach((question, i) => {
      console.log(`\n${question}\n${result.draft.answers[i] ?? ""}`);
    });
    if (result.draft.costUsd !== null) console.log(`\n~$${result.draft.costUsd.toFixed(3)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
