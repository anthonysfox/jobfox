import { describe, expect, it } from "vitest";
import { makeJob } from "../test/make-job.ts";
import { canonicalize, groupJobs, mergeCanonical } from "./dedupe.ts";

describe("groupJobs", () => {
  it("merges the same job from different sources", () => {
    const groups = groupJobs([
      makeJob({ source: "ADZUNA", companyName: "Acme Inc.", location: "New York, NY" }),
      makeJob({ source: "HN_HIRING", companyName: "Acme", location: "NYC" }),
      makeJob({ source: "ADZUNA", companyName: "Globex" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.postings.map((p) => p.source)).toEqual(["ADZUNA", "HN_HIRING"]);
  });

  it("keeps first-seen order", () => {
    const groups = groupJobs([
      makeJob({ companyName: "B" }),
      makeJob({ companyName: "A" }),
      makeJob({ companyName: "B" }),
    ]);
    expect(groups.map((g) => g.postings[0]?.companyName)).toEqual(["B", "A"]);
  });
});

describe("canonicalize", () => {
  it("prefers the ATS description over a truncated aggregator one", () => {
    const job = canonicalize([
      makeJob({ source: "ADZUNA", description: "Short…", descriptionTruncated: true }),
      makeJob({
        source: "GREENHOUSE",
        url: "https://boards.greenhouse.io/acme/jobs/1",
        description: "Full description",
      }),
    ]);

    expect(job.description).toBe("Full description");
    expect(job.descriptionSource).toBe("GREENHOUSE");
    expect(job.applyUrl).toBe("https://boards.greenhouse.io/acme/jobs/1");
  });

  it("prefers an HN description over a truncated Adzuna one", () => {
    const job = canonicalize([
      makeJob({ source: "ADZUNA", description: "Short…", descriptionTruncated: true }),
      makeJob({ source: "HN_HIRING", description: "Long HN post" }),
    ]);
    expect(job.descriptionSource).toBe("HN_HIRING");
  });

  it("falls back to a lower-priority description when the best posting has none", () => {
    const job = canonicalize([
      makeJob({ source: "HN_HIRING", description: null }),
      makeJob({ source: "ADZUNA", description: "Something", descriptionTruncated: true }),
    ]);
    expect(job.description).toBe("Something");
  });

  it("uses a direct apply link before the source URL", () => {
    const job = canonicalize([
      makeJob({
        source: "HN_HIRING",
        url: "https://news.ycombinator.com/item?id=1",
        applyUrl: "https://acme.com/careers",
      }),
    ]);
    expect(job.applyUrl).toBe("https://acme.com/careers");
  });

  it("takes the first known workplace type, salary, and earliest posted date", () => {
    const job = canonicalize([
      makeJob({ source: "GREENHOUSE", workplaceType: "UNKNOWN", postedAt: new Date("2026-10-10") }),
      makeJob({
        source: "ADZUNA",
        workplaceType: "HYBRID",
        salary: { min: 120000, max: 150000, currency: "USD" },
        postedAt: new Date("2026-10-01"),
      }),
    ]);

    expect(job.workplaceType).toBe("HYBRID");
    expect(job.salary?.min).toBe(120000);
    expect(job.postedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("mergeCanonical", () => {
  const adzuna = canonicalize([
    makeJob({
      source: "ADZUNA",
      title: "Full Stack Engineer",
      description: "Short…",
      descriptionTruncated: true,
      salary: { min: 1, max: 2, currency: "USD" },
      postedAt: new Date("2026-10-01"),
    }),
  ]);
  const greenhouse = canonicalize([
    makeJob({
      source: "GREENHOUSE",
      title: "Full-Stack Engineer",
      url: "https://boards.greenhouse.io/acme/jobs/1",
      description: "Full description",
      workplaceType: "HYBRID",
      postedAt: new Date("2026-10-05"),
    }),
  ]);

  it("upgrades an Adzuna job when the ATS posting arrives later", () => {
    const merged = mergeCanonical(adzuna, greenhouse);

    expect(merged).toMatchObject({
      title: "Full-Stack Engineer",
      description: "Full description",
      descriptionSource: "GREENHOUSE",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
      workplaceType: "HYBRID",
    });
    // Gaps are filled from the other side; the earliest date wins.
    expect(merged.salary?.min).toBe(1);
    expect(merged.postedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("does not downgrade an ATS job when Adzuna sees it again", () => {
    const merged = mergeCanonical(greenhouse, adzuna);

    expect(merged.descriptionSource).toBe("GREENHOUSE");
    expect(merged.applyUrl).toBe("https://boards.greenhouse.io/acme/jobs/1");
  });
});
