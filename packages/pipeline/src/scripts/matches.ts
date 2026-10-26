import userConfig from "../../jobfox.config.js";
import { parseConfig } from "../core/config.js";
import { createDb } from "../lib/db.js";
import { findCurrentMatches, STALE_AFTER_DAYS, type MatchedJob } from "../pipeline/matches.js";
import { currentScore, loadScoringContext } from "../scoring/context.js";

/*
 * List jobs worth applying to, best fit first. Weak fits are counted but not
 * listed; run `pnpm score` first to score new jobs.
 */

function where(job: MatchedJob): string {
  return [job.location, job.workplaceType !== "UNKNOWN" ? job.workplaceType : null]
    .filter(Boolean)
    .join(" · ");
}

async function main(): Promise<void> {
  const config = parseConfig(userConfig);
  const context = loadScoringContext(config);
  const db = createDb();

  try {
    const jobs = await findCurrentMatches(db, config.filters);
    const withScores = jobs.map((job) => ({ job, score: currentScore(job.scores, context) }));
    const byVerdict = (verdict: string) =>
      withScores
        .filter((x) => x.score?.verdict === verdict)
        .sort((a, b) => (b.score?.fitScore ?? 0) - (a.score?.fitScore ?? 0));

    for (const [heading, group] of [
      ["Strong fits", byVerdict("STRONG")],
      ["Possible fits", byVerdict("POSSIBLE")],
    ] as const) {
      console.log(`\n${heading} (${group.length})`);
      for (const { job, score } of group) {
        console.log(
          `  ${String(score?.fitScore).padStart(3)}  ${job.company.name} — ${job.title} — ${where(job)}`,
        );
        if (score) console.log(`       ${score.summary}`);
        if (score && score.gaps.length > 0) console.log(`       Gaps: ${score.gaps.join("; ")}`);
        console.log(`       ${job.applyUrl}`);
      }
    }

    const weak = byVerdict("WEAK").length;
    const unscored = withScores.filter((x) => !x.score).length;
    console.log(
      `\n${jobs.length} matches seen in the last ${STALE_AFTER_DAYS} days: ` +
        `${weak} weak fits hidden${unscored > 0 ? `, ${unscored} not scored yet (pnpm score)` : ""}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
