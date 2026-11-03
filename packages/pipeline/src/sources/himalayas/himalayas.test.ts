import { describe, expect, it } from "vitest";
import { parseConfig } from "../../core/config.ts";
import { createFakeHttp } from "../../test/fake-http.ts";
import search from "./fixtures/search.json" with { type: "json" };
import { createHimalayasSource, formatLocation } from "./source.ts";

const NOW = new Date("2026-11-03T12:00:00Z");
const isHimalayas = (url: URL) => url.host === "himalayas.app";

function himalayasConfig(overrides: Record<string, unknown> = {}) {
  return parseConfig({
    adzuna: { searches: [{ what: "x" }] },
    himalayas: { searches: ["react developer"], employmentType: "Contractor", ...overrides },
    filters: {},
  }).himalayas;
}

async function fetchFixture(
  options: { contractOnly?: boolean; config?: Record<string, unknown> } = {},
) {
  const http = createFakeHttp([{ match: isHimalayas, body: search }]);
  const jobs = await createHimalayasSource({
    http,
    config: himalayasConfig(options.config),
    contractOnly: options.contractOnly ?? false,
    now: () => NOW,
  }).fetchJobs();
  return { http, jobs };
}

describe("createHimalayasSource", () => {
  it("searches by keyword, country, and employment type", async () => {
    const { http } = await fetchFixture();
    const url = http.requests[0];
    expect(url?.pathname).toBe("/jobs/api/search");
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      q: "react developer",
      country: "US",
      employment_type: "Contractor",
      page: "1",
    });
  });

  it("stops paging when a page holds fewer than 20 jobs", async () => {
    const { http } = await fetchFixture({ config: { maxPagesPerSearch: 3 } });
    expect(http.requests).toHaveLength(1);
  });

  it("asks for contractors in contract-only mode, whatever the config says", async () => {
    const { http } = await fetchFixture({
      contractOnly: true,
      config: { employmentType: undefined },
    });
    expect(http.requests[0]?.searchParams.get("employment_type")).toBe("Contractor");
  });

  it("maps a job, keeping Himalayas' link as the posting URL", async () => {
    const { jobs } = await fetchFixture();
    expect(jobs[0]).toMatchObject({
      source: "HIMALAYAS",
      externalId: "https://himalayas.app/companies/fabrikam/jobs/senior-react-developer-contract",
      url: "https://himalayas.app/companies/fabrikam/jobs/senior-react-developer-contract",
      applyUrl: null,
      title: "Senior React Developer (Contract)",
      companyName: "Fabrikam",
      location: "Remote (US)",
      workplaceType: "REMOTE",
      employmentType: "CONTRACT",
      salary: { min: 120000, max: 160000, currency: "USD" },
      postedAt: new Date(1793500000 * 1000),
    });
    expect(jobs[0]?.description).toContain("This is a 6-month contract.");
  });

  it("drops hourly rates rather than storing them as a salary", async () => {
    const { jobs } = await fetchFixture();
    expect(jobs.find((j) => j.companyName === "Northwind")?.salary).toBeNull();
  });

  it("skips expired jobs", async () => {
    const { jobs } = await fetchFixture();
    expect(jobs.map((j) => j.companyName)).toEqual(["Fabrikam", "Northwind", "Contoso"]);
  });
});

describe("formatLocation", () => {
  it.each([
    [[], "Remote (Worldwide)"],
    [null, "Remote (Worldwide)"],
    [["Canada", "United States"], "Remote (US)"],
    [["Argentina", "Brazil", "Colombia", "Mexico"], "Remote (Argentina, Brazil, Colombia, …)"],
  ])("%j -> %s", (restrictions, expected) => {
    expect(formatLocation(restrictions)).toBe(expected);
  });
});
