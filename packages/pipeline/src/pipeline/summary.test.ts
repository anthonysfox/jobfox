import { describe, expect, it } from "vitest";
import { canonicalize } from "./dedupe.ts";
import { makeJob } from "../test/make-job.ts";
import { formatSummary, type RunSummary } from "./summary.ts";

const summary: RunSummary = {
  startedAt: new Date("2026-10-26T16:00:00Z"),
  durationMs: 42_000,
  sources: [
    { name: "hn", status: "ok", jobs: 263 },
    { name: "adzuna", status: "skipped", jobs: 0, detail: "no Adzuna credentials in .env" },
    { name: "greenhouse:acme", status: "skipped", jobs: 0 },
    { name: "greenhouse:globex", status: "skipped", jobs: 0 },
    { name: "lever:initech", status: "ok", jobs: 12 },
  ],
  postings: 275,
  groups: 270,
  newMatches: [
    canonicalize([
      makeJob({
        companyName: "Acme",
        title: "Full Stack Engineer",
        location: "New York, NY",
        workplaceType: "HYBRID",
        url: "https://news.ycombinator.com/item?id=1",
      }),
    ]),
  ],
  newRejected: 200,
  seenBefore: 69,
  rejectCounts: new Map([
    ["location:not-allowed", 150],
    ["title:no-keyword-match", 80],
  ]),
  atsDescriptionsAdded: 0,
  boardsAdded: [
    { ats: "GREENHOUSE", slug: "acme" },
    { ats: "LEVER", slug: "initech" },
  ],
  notImplemented: new Map([["GREENHOUSE", 14]]),
  errors: [],
};

describe("formatSummary", () => {
  const text = formatSummary(summary);

  it("reports each source and collapses boards per ATS", () => {
    expect(text).toContain("✓ hn              263 jobs");
    expect(text).toContain("– adzuna          no Adzuna credentials in .env");
    expect(text).toContain("– greenhouse      2 skipped (client not implemented)");
    expect(text).toContain("✓ lever           1 boards, 12 jobs");
  });

  it("reports pipeline counts and pending ATS clients", () => {
    expect(text).toContain("275 postings → 270 jobs after dedupe (201 new, 69 seen before)");
    expect(text).toContain("2 new boards to poll (greenhouse 1, lever 1)");
    expect(text).toContain("ATS clients not implemented yet, skipped: greenhouse (14)");
  });

  it("lists new matches with their apply link", () => {
    expect(text).toContain("Acme — Full Stack Engineer — New York, NY · HYBRID");
    expect(text).toContain("https://news.ycombinator.com/item?id=1");
  });
});
