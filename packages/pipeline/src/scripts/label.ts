import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import userConfig from "../../jobfox.config.ts";
import { parseConfig } from "../core/config.ts";
import { createDb } from "../lib/db.ts";
import { findCurrentMatches, type MatchedJob } from "../pipeline/matches.ts";
import { loadScoringContext } from "../scoring/context.ts";
import { createLocalEmbedder } from "../scoring/embed.ts";
import { spreadEvenly } from "../scoring/metrics.ts";
import { embedMissing } from "../scoring/run.ts";
import { rankBySimilarity } from "../scoring/store.ts";

/*
 * Hand-label jobs for the eval. Claude's score is never shown, so it can't
 * anchor my judgment. Jobs are picked evenly across the similarity range, so
 * the set includes clear misses as well as likely hits.
 */

const DEFAULT_COUNT = 30;
const DESCRIPTION_PREVIEW = 1500;
const ANSWERS = { s: "STRONG", p: "POSSIBLE", w: "WEAK" } as const;

function show(job: MatchedJob, index: number, total: number): void {
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ?? "?"} – ${job.salaryMax ?? "?"} ${job.salaryCurrency ?? ""}`
      : null;
  const description = job.description ?? "(no description)";
  console.log(`\n━━━ ${index + 1}/${total} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${job.company.name} — ${job.title}`);
  console.log([job.location, job.workplaceType, salary].filter(Boolean).join(" · "));
  console.log(job.applyUrl);
  console.log(
    `\n${description.slice(0, DESCRIPTION_PREVIEW)}${description.length > DESCRIPTION_PREVIEW ? "…" : ""}`,
  );
}

async function main(): Promise<void> {
  const config = parseConfig(userConfig);
  const context = loadScoringContext(config);
  const countArg = process.argv.indexOf("--count");
  const count =
    countArg !== -1 ? Number(process.argv[countArg + 1]) || DEFAULT_COUNT : DEFAULT_COUNT;
  const db = createDb();
  const rl = createInterface({ input: stdin, output: stdout });
  // Ctrl-D (or the end of piped input) closes readline; treat it as quitting.
  const ask = (prompt: string) => rl.question(prompt).catch(() => "q");

  try {
    const matches = await findCurrentMatches(db, config.filters);
    const unlabeled = matches.filter((j) => !j.label);
    const embedder = await createLocalEmbedder();
    await embedMissing(db, embedder, unlabeled);
    const similarity = await rankBySimilarity(
      db,
      unlabeled.map((j) => j.id),
      await embedder.embedQuery(context.resume),
    );
    const ranked = unlabeled
      .filter((j) => similarity.has(j.id))
      .sort((a, b) => (similarity.get(b.id) ?? 0) - (similarity.get(a.id) ?? 0));
    const queue = spreadEvenly(ranked, count);

    const already = matches.length - unlabeled.length;
    console.log(`${already} jobs labeled so far. Labeling ${queue.length} more.`);
    console.log(
      "For each: [s]trong (apply)  [p]ossible (maybe)  [w]eak (skip)  [n] skip job  [q]uit",
    );

    let saved = 0;
    for (const [i, job] of queue.entries()) {
      show(job, i, queue.length);
      const answer = (await ask("\nLabel [s/p/w/n/q]: ")).trim().toLowerCase();
      if (answer === "q") break;
      if (!(answer in ANSWERS)) continue;

      const note = (await ask("Note (optional, Enter to skip): ")).trim();
      await db.jobLabel.create({
        data: { jobId: job.id, label: ANSWERS[answer as keyof typeof ANSWERS], note: note || null },
      });
      saved++;
    }
    console.log(
      `\nSaved ${saved} labels (${already + saved} total). Run pnpm eval to measure the scorer.`,
    );
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
