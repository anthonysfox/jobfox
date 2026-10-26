import userConfig from "../../jobfox.config.js";
import { parseConfig } from "../core/config.js";
import { createDb } from "../lib/db.js";
import { containsPhrase } from "../lib/normalize.js";
import { rejectReasons } from "../pipeline/filters.js";

/*
 * List jobs worth applying to. Filters are re-applied from the current
 * jobfox.config.ts, so config changes show up without fetching again.
 * Jobs not seen in the last few runs have likely been filled and are hidden.
 */

const STALE_AFTER_DAYS = 3;

async function main(): Promise<void> {
  const config = parseConfig(userConfig);
  const db = createDb();

  try {
    const since = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const jobs = await db.job.findMany({
      where: { lastSeenAt: { gte: since } },
      include: { company: true },
      orderBy: { firstSeenAt: "desc" },
    });

    const matches = jobs
      .map((job) => ({ job, companyName: job.company.name }))
      .filter(
        ({ job, companyName }) =>
          rejectReasons({ ...job, companyName }, config.filters).length === 0,
      );

    const isLocal = (location: string | null) =>
      config.filters.locations.some((place) => containsPhrase(location ?? "", place));
    const local = matches.filter(({ job }) => isLocal(job.location));
    const elsewhere = matches.filter(({ job }) => !isLocal(job.location));

    for (const [heading, group] of [
      ["Local", local],
      ["Remote", elsewhere],
    ] as const) {
      console.log(`\n${heading} (${group.length})`);
      for (const { job, companyName } of group) {
        const where = [job.location, job.workplaceType !== "UNKNOWN" ? job.workplaceType : null]
          .filter(Boolean)
          .join(" · ");
        console.log(`  ${companyName} — ${job.title}${where ? ` — ${where}` : ""}`);
        console.log(`    ${job.applyUrl}`);
      }
    }
    console.log(
      `\n${matches.length} matches from ${jobs.length} jobs seen in the last ${STALE_AFTER_DAYS} days`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
