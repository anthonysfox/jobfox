import { describe, expect, it, vi } from "vitest";
import type { Ats } from "../core/job.ts";
import { NotImplementedError, type AtsClient } from "../sources/ats/types.ts";
import { createFakeHttp } from "../test/fake-http.ts";
import { makeJob } from "../test/make-job.ts";
import type { JobGroup } from "./dedupe.ts";
import { candidateUrls, enrichGroup } from "./enrich.ts";

const GH_URL = "https://boards.greenhouse.io/acme/jobs/123";

function fakeClients(getJob: AtsClient["getJob"]): Record<Ats, AtsClient> {
  const client: AtsClient = { listJobs: () => Promise.resolve([]), getJob };
  return { GREENHOUSE: client, LEVER: client, ASHBY: client };
}

function group(...postings: ReturnType<typeof makeJob>[]): JobGroup {
  return { key: "acme|full stack engineer|new york", postings };
}

describe("candidateUrls", () => {
  it("uses applyUrl and links in HN post bodies", () => {
    const g = group(
      makeJob({
        source: "HN_HIRING",
        applyUrl: "https://acme.com",
        description: `Apply: ${GH_URL}`,
      }),
    );
    expect(candidateUrls(g)).toEqual(["https://acme.com", GH_URL]);
  });

  it("never includes Adzuna redirect URLs", () => {
    const g = group(makeJob({ source: "ADZUNA", url: "https://www.adzuna.com/land/ad/1" }));
    expect(candidateUrls(g)).toEqual([]);
  });
});

describe("enrichGroup", () => {
  it("attaches the full ATS posting and reports the board", async () => {
    const atsJob = makeJob({ source: "GREENHOUSE", externalId: "123", url: GH_URL });
    const getJob = vi.fn<AtsClient["getJob"]>().mockResolvedValue(atsJob);
    const g = group(makeJob({ source: "HN_HIRING", applyUrl: GH_URL }));

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([]),
      clients: fakeClients(getJob),
    });

    expect(outcome).toMatchObject({
      board: { ats: "GREENHOUSE", slug: "acme", jobId: "123" },
      attached: true,
    });
    expect(getJob).toHaveBeenCalledWith(
      expect.anything(),
      { slug: "acme", companyName: "Acme" },
      "123",
    );
    expect(g.postings).toContain(atsJob);
  });

  it("resolves Greenhouse short links", async () => {
    const getJob = vi.fn<AtsClient["getJob"]>().mockResolvedValue(null);
    const g = group(makeJob({ source: "HN_HIRING", applyUrl: "https://grnh.se/abc123" }));

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([], { "https://grnh.se/abc123": GH_URL }),
      clients: fakeClients(getJob),
    });

    expect(outcome.board).toEqual({ ats: "GREENHOUSE", slug: "acme", jobId: "123" });
  });

  it("only reports the board for multi-role posts", async () => {
    const getJob = vi.fn<AtsClient["getJob"]>();
    const g = group(makeJob({ source: "HN_HIRING", externalId: "42#1", applyUrl: GH_URL }));

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([]),
      clients: fakeClients(getJob),
    });

    expect(outcome.board?.slug).toBe("acme");
    expect(getJob).not.toHaveBeenCalled();
  });

  it("skips groups that already have an ATS posting", async () => {
    const getJob = vi.fn<AtsClient["getJob"]>();
    const g = group(
      makeJob({ source: "LEVER" }),
      makeJob({ source: "HN_HIRING", applyUrl: GH_URL }),
    );

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([]),
      clients: fakeClients(getJob),
    });

    expect(outcome.board).toBeNull();
    expect(getJob).not.toHaveBeenCalled();
  });

  it("still reports the board when the client isn't implemented yet", async () => {
    const getJob = vi
      .fn<AtsClient["getJob"]>()
      .mockRejectedValue(new NotImplementedError("getGreenhouseJob"));
    const g = group(makeJob({ source: "HN_HIRING", applyUrl: GH_URL }));

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([]),
      clients: fakeClients(getJob),
    });

    expect(outcome).toMatchObject({
      board: { slug: "acme" },
      attached: false,
      notImplemented: "GREENHOUSE",
      error: null,
    });
  });

  it("reports other errors without throwing", async () => {
    const getJob = vi.fn<AtsClient["getJob"]>().mockRejectedValue(new Error("boom"));
    const g = group(makeJob({ source: "HN_HIRING", applyUrl: GH_URL }));

    const outcome = await enrichGroup(g, "Acme", {
      http: createFakeHttp([]),
      clients: fakeClients(getJob),
    });

    expect(outcome.error).toContain("boom");
  });
});
