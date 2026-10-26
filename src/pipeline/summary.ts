import type { Ats } from "../core/job.js";
import type { CanonicalJob } from "./dedupe.js";

export interface SourceReport {
  name: string;
  status: "ok" | "failed" | "skipped";
  jobs: number;
  detail?: string;
}

export interface RunSummary {
  startedAt: Date;
  durationMs: number;
  sources: SourceReport[];
  postings: number;
  groups: number;
  newMatches: CanonicalJob[];
  newRejected: number;
  seenBefore: number;
  rejectCounts: Map<string, number>;
  atsDescriptionsAdded: number;
  boardsAdded: { ats: Ats; slug: string }[];
  notImplemented: Map<Ats, number>;
  errors: string[];
}

const MAX_LISTED = 25;

function pad(text: string, width: number): string {
  return text.length >= width ? `${text} ` : text.padEnd(width);
}

function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** Board sources are named "greenhouse:acme"; collapse them into one line per ATS. */
function formatSources(sources: SourceReport[]): string[] {
  const lines: string[] = [];
  const icon = { ok: "✓", failed: "✗", skipped: "–" } as const;

  for (const s of sources.filter((s) => !s.name.includes(":"))) {
    const detail = s.status === "ok" ? `${s.jobs} jobs` : (s.detail ?? s.status);
    lines.push(`  ${icon[s.status]} ${pad(s.name, 16)}${detail}`);
  }

  const boards = sources.filter((s) => s.name.includes(":"));
  for (const [ats] of countBy(boards, (s) => s.name.split(":")[0] ?? "")) {
    const mine = boards.filter((s) => s.name.startsWith(`${ats}:`));
    const ok = mine.filter((s) => s.status === "ok");
    const skipped = mine.filter((s) => s.status === "skipped");
    const failed = mine.filter((s) => s.status === "failed");
    const parts = [
      ok.length > 0 ? `${ok.length} boards, ${ok.reduce((n, s) => n + s.jobs, 0)} jobs` : null,
      skipped.length > 0 ? `${skipped.length} skipped (client not implemented)` : null,
      failed.length > 0 ? `${failed.length} failed` : null,
    ].filter(Boolean);
    const status = ok.length > 0 ? "✓" : skipped.length > 0 ? "–" : "✗";
    lines.push(`  ${status} ${pad(ats, 16)}${parts.join(", ")}`);
  }
  return lines;
}

function formatJob(job: CanonicalJob): string[] {
  const where = [job.location, job.workplaceType !== "UNKNOWN" ? job.workplaceType : null]
    .filter(Boolean)
    .join(" · ");
  return [
    `  ${job.companyName} — ${job.title}${where ? ` — ${where}` : ""}`,
    `    ${job.applyUrl}`,
  ];
}

export function formatSummary(s: RunSummary): string {
  const lines: string[] = [];
  const seconds = Math.round(s.durationMs / 1000);
  lines.push(`jobfox discover · ${s.startedAt.toISOString()} · ${seconds}s`, "");

  lines.push("Sources", ...formatSources(s.sources), "");

  const newJobs = s.newMatches.length + s.newRejected;
  lines.push(
    "Pipeline",
    `  ${s.postings} postings → ${s.groups} jobs after dedupe (${newJobs} new, ${s.seenBefore} seen before)`,
  );
  const boardsByAts = countBy(s.boardsAdded, (b) => b.ats.toLowerCase())
    .map(([ats, n]) => `${ats} ${n}`)
    .join(", ");
  lines.push(
    `  Enrichment: ${s.atsDescriptionsAdded} full ATS descriptions, ` +
      `${s.boardsAdded.length} new boards to poll${boardsByAts ? ` (${boardsByAts})` : ""}`,
  );
  if (s.notImplemented.size > 0) {
    const pending = [...s.notImplemented]
      .map(([ats, n]) => `${ats.toLowerCase()} (${n})`)
      .join(", ");
    lines.push(`  ATS clients not implemented yet, skipped: ${pending}`);
  }
  if (s.errors.length > 0) {
    lines.push(`  ${s.errors.length} errors:`, ...s.errors.slice(0, 5).map((e) => `    ${e}`));
  }
  lines.push("");

  if (s.rejectCounts.size > 0) {
    lines.push(`Rejected new jobs: ${s.newRejected}`);
    for (const [reason, n] of [...s.rejectCounts].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${pad(reason, 32)}${n}`);
    }
    lines.push("");
  }

  lines.push(`New matches: ${s.newMatches.length}`);
  for (const job of s.newMatches.slice(0, MAX_LISTED)) lines.push(...formatJob(job));
  if (s.newMatches.length > MAX_LISTED) {
    lines.push(`  …and ${s.newMatches.length - MAX_LISTED} more (pnpm db:studio to browse)`);
  }

  return lines.join("\n");
}
