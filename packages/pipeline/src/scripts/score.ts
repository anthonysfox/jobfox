import Anthropic from "@anthropic-ai/sdk";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import { createDb } from "../lib/db.ts";
import { findCurrentMatches } from "../pipeline/matches.ts";
import { currentScore, loadScoringContext } from "../scoring/context.ts";
import { createLocalEmbedder } from "../scoring/embed.ts";
import { scoreJobs } from "../scoring/run.ts";

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  if (!env.ANTHROPIC_API_KEY) throw new Error("Add ANTHROPIC_API_KEY to .env to score jobs.");
  const config = parseConfig(userConfig);
  // `pnpm score --limit 5` caps this run without editing the config.
  const limitArg = process.argv.indexOf("--limit");
  if (limitArg !== -1) config.scoring.maxJobsPerRun = Number(process.argv[limitArg + 1]) || 1;
  const context = loadScoringContext(config);
  const db = createDb();

  try {
    const jobs = await findCurrentMatches(db, config.filters);
    console.log(`${jobs.length} current matches. Loading embedding model…`);
    const embedder = await createLocalEmbedder();

    const result = await scoreJobs({
      db,
      client: new Anthropic(),
      embedder,
      config,
      context,
      jobs,
      onProgress: (done, total) => {
        if (done % 25 === 0 || done === total) console.log(`  scored ${done}/${total}`);
      },
    });

    const { usage } = result;
    const cachedShare =
      usage.cacheReadTokens /
      Math.max(1, usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens);
    console.log(
      [
        "",
        `Embedded ${result.embedded} jobs; scored ${result.scored} with ${config.scoring.model}.`,
        result.skippedOverLimit > 0
          ? `${result.skippedOverLimit} less-similar jobs left unscored (scoring.maxJobsPerRun).`
          : null,
        usage.requests > 0
          ? `Tokens: ${usage.inputTokens} input, ${usage.cacheReadTokens} cached (${Math.round(cachedShare * 100)}%), ` +
            `${usage.outputTokens} output. Estimated cost: ${result.costUsd === null ? "unknown" : `$${result.costUsd.toFixed(3)}`}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (result.failures.length > 0) {
      console.log(`\n${result.failures.length} failed:`);
      for (const f of result.failures.slice(0, 10)) console.log(`  ${f}`);
    }

    // Re-read so the top list includes what was just scored.
    const refreshed = await findCurrentMatches(db, config.filters);
    const top = refreshed
      .flatMap((job) => {
        const score = currentScore(job.scores, context);
        return score ? [{ job, score }] : [];
      })
      .sort((a, b) => b.score.fitScore - a.score.fitScore)
      .slice(0, 15);

    console.log("\nTop matches (pnpm matches for all):");
    for (const { job, score } of top) {
      console.log(`  ${String(score.fitScore).padStart(3)}  ${job.company.name} — ${job.title}`);
      console.log(`       ${score.summary}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
