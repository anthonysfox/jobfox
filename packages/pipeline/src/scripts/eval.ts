import Anthropic from "@anthropic-ai/sdk";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "../core/config.ts";
import { createDb } from "../lib/db.ts";
import { currentScore, loadScoringContext } from "../scoring/context.ts";
import { createLocalEmbedder } from "../scoring/embed.ts";
import { computeMetrics, VERDICTS, type EvalRow } from "../scoring/metrics.ts";
import { scoreJobs } from "../scoring/run.ts";
import { toVerdict } from "../scoring/scorer.ts";

/*
 * Measure the scorer against my hand labels. Scores any labeled job that
 * isn't scored yet for the current prompt and model, then reports agreement,
 * rank correlation, and the embedding-only baseline. Each run is saved as an EvalRun.
 *
 *   pnpm eval                          # model from jobfox.config.ts
 *   pnpm eval --model claude-sonnet-5-5
 */

const MIN_LABELS = 10;

function pct(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function corr(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  if (!env.ANTHROPIC_API_KEY) throw new Error("Add ANTHROPIC_API_KEY to .env to run the eval.");
  const config = parseConfig(userConfig);
  const modelArg = process.argv.indexOf("--model");
  if (modelArg !== -1 && process.argv[modelArg + 1]) {
    config.scoring.model = process.argv[modelArg + 1] ?? config.scoring.model;
  }
  const context = loadScoringContext(config);
  const db = createDb();

  try {
    const include = { company: true, scores: true, label: true } as const;
    const labeled = await db.job.findMany({ where: { label: { isNot: null } }, include });
    if (labeled.length < MIN_LABELS) {
      throw new Error(
        `Only ${labeled.length} labeled jobs; label at least ${MIN_LABELS} with pnpm label.`,
      );
    }

    config.scoring.maxJobsPerRun = labeled.length;
    const run = await scoreJobs({
      db,
      client: new Anthropic(),
      embedder: await createLocalEmbedder(),
      config,
      context,
      jobs: labeled,
      alwaysInclude: new Set(labeled.map((j) => j.id)),
    });

    const refreshed = await db.job.findMany({ where: { label: { isNot: null } }, include });
    const rows = refreshed.flatMap((job) => {
      const score = currentScore(job.scores, context);
      if (!score || !job.label) return [];
      const row: EvalRow = {
        label: job.label.label,
        verdict: toVerdict(score.fitScore, config.scoring),
        fitScore: score.fitScore,
        similarity: score.similarity,
      };
      return [{ job, score, row }];
    });
    const metrics = computeMetrics(rows.map((r) => r.row));

    console.log(
      `\nEval: ${config.scoring.model} (effort ${config.scoring.effort}) on ${metrics.n} labeled jobs`,
    );
    if (run.usage.requests > 0) {
      console.log(
        `  scored ${run.scored} new${run.costUsd === null ? "" : `, ~$${run.costUsd.toFixed(3)}`}`,
      );
    }
    console.log(
      `  Verdict agreement:     ${pct(metrics.accuracy)} exact, ${pct(metrics.withinOne)} within one step`,
    );
    console.log(
      `  Precision@k:           ${pct(metrics.precisionAtK)} of the top-scored jobs are ones I'd apply to`,
    );
    console.log(
      `  Rank correlation:      score ${corr(metrics.scoreSpearman)} vs. embeddings alone ${corr(metrics.similaritySpearman)}`,
    );

    console.log("\n  Confusion (rows: my label, columns: scorer)");
    console.log(`  ${"".padEnd(10)}${VERDICTS.map((v) => v.padStart(10)).join("")}`);
    for (const label of VERDICTS) {
      console.log(
        `  ${label.padEnd(10)}${VERDICTS.map((v) => String(metrics.confusion[label][v]).padStart(10)).join("")}`,
      );
    }

    const misses = rows.filter((r) => r.row.label !== r.row.verdict);
    if (misses.length > 0) {
      console.log(`\n  Disagreements (${misses.length}):`);
      for (const { job, score, row } of misses) {
        console.log(
          `  - ${job.company.name} — ${job.title}: I said ${row.label}, scorer ${score.fitScore} (${row.verdict})`,
        );
        console.log(`      ${score.summary}`);
        if (job.label?.note) console.log(`      My note: ${job.label.note}`);
      }
    }
    if (run.failures.length > 0) {
      console.log(`\n  ${run.failures.length} jobs failed to score:`, run.failures.slice(0, 5));
    }

    const saved = await db.evalRun.create({
      data: {
        model: config.scoring.model,
        effort: config.scoring.effort,
        promptHash: context.promptHash,
        thresholds: {
          strong: config.scoring.strongThreshold,
          possible: config.scoring.possibleThreshold,
        },
        metrics: { ...metrics },
        rows: rows.map(({ job, score, row }) => ({
          jobId: job.id,
          title: job.title,
          company: job.company.name,
          summary: score.summary,
          note: job.label?.note ?? null,
          ...row,
        })),
      },
    });
    console.log(`\n  Saved eval run ${saved.id} (see /eval in the dashboard)`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
