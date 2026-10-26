import { describe, expect, it } from "vitest";
import { parseConfig } from "../../core/config.js";
import { createFakeHttp } from "../../test/fake-http.js";
import page1 from "./fixtures/search-page-1.json" with { type: "json" };
import { buildSearchUrl } from "./client.js";
import { createAdzunaSource } from "./source.js";

const credentials = { appId: "test-id", appKey: "test-key" };

function adzunaConfig(overrides: Record<string, unknown> = {}) {
  return parseConfig({
    adzuna: { searches: [{ what: "full stack engineer", where: "New York" }], ...overrides },
    filters: {},
  }).adzuna;
}

const isAdzuna = (url: URL) => url.host === "api.adzuna.com";

describe("buildSearchUrl", () => {
  it("builds the documented search URL", () => {
    const url = buildSearchUrl(credentials, {
      country: "us",
      page: 2,
      what: "react developer",
      where: "New York",
      distanceKm: 40,
      maxDaysOld: 14,
      resultsPerPage: 50,
    });

    expect(url.origin + url.pathname).toBe("https://api.adzuna.com/v1/api/jobs/us/search/2");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      app_id: "test-id",
      app_key: "test-key",
      what: "react developer",
      where: "New York",
      distance: "40",
      max_days_old: "14",
      results_per_page: "50",
      sort_by: "date",
    });
  });

  it("omits where and distance for US-wide searches", () => {
    const url = buildSearchUrl(credentials, {
      country: "us",
      page: 1,
      what: "react remote",
      maxDaysOld: 14,
      resultsPerPage: 50,
    });
    expect(url.searchParams.has("where")).toBe(false);
    expect(url.searchParams.has("distance")).toBe(false);
  });
});

describe("createAdzunaSource", () => {
  it("maps results to Jobs", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    const source = createAdzunaSource({ http, credentials, config: adzunaConfig() });

    const jobs = await source.fetchJobs();

    expect(jobs[0]).toMatchObject({
      source: "ADZUNA",
      externalId: "4901234567",
      url: "https://www.adzuna.com/land/ad/4901234567?se=abc&utm_medium=api&utm_source=test&v=1",
      applyUrl: null,
      title: "Full Stack Engineer – React & Node",
      companyName: "Acme Inc.",
      location: "Manhattan, New York County",
      workplaceType: "HYBRID",
      descriptionTruncated: true,
      salary: { min: 130000, max: 160000, currency: "USD" },
      postedAt: new Date("2026-10-21T14:02:11Z"),
    });
  });

  it("drops Adzuna's predicted salaries", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    const jobs = await createAdzunaSource({
      http,
      credentials,
      config: adzunaConfig(),
    }).fetchJobs();

    expect(jobs.find((j) => j.companyName === "Globex")?.salary).toBeNull();
  });

  it("skips results without a company", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    const jobs = await createAdzunaSource({
      http,
      credentials,
      config: adzunaConfig(),
    }).fetchJobs();

    expect(jobs.map((j) => j.externalId)).toEqual(["4901234567", "4901234999"]);
  });

  it("stops paging when a page is not full", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    await createAdzunaSource({
      http,
      credentials,
      config: adzunaConfig({ maxPagesPerSearch: 3 }),
    }).fetchJobs();

    expect(http.requests).toHaveLength(1);
  });

  it("pages until maxPagesPerSearch when pages are full", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    await createAdzunaSource({
      http,
      credentials,
      config: adzunaConfig({ resultsPerPage: 3, maxPagesPerSearch: 2 }),
    }).fetchJobs();

    expect(http.requests.map((u) => u.pathname)).toEqual([
      "/v1/api/jobs/us/search/1",
      "/v1/api/jobs/us/search/2",
    ]);
  });

  it("dedupes the same job across searches", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: page1 }]);
    const jobs = await createAdzunaSource({
      http,
      credentials,
      config: adzunaConfig({
        searches: [{ what: "full stack engineer" }, { what: "frontend engineer" }],
      }),
    }).fetchJobs();

    expect(http.requests).toHaveLength(2);
    expect(jobs).toHaveLength(2);
  });

  it("rejects a response that doesn't match the schema", async () => {
    const http = createFakeHttp([{ match: isAdzuna, body: { results: "nope" } }]);
    await expect(
      createAdzunaSource({ http, credentials, config: adzunaConfig() }).fetchJobs(),
    ).rejects.toThrow();
  });
});
