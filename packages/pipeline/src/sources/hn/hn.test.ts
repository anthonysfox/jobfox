import { describe, expect, it } from "vitest";
import { UNKNOWN_TITLE } from "../../core/job.js";
import { createFakeHttp } from "../../test/fake-http.js";
import search from "./fixtures/search.json" with { type: "json" };
import thread from "./fixtures/thread.json" with { type: "json" };
import { parseHeader } from "./parse.js";
import { createHnSource } from "./source.js";

const routes = [
  { match: (u: URL) => u.pathname === "/api/v1/search_by_date", body: search },
  { match: (u: URL) => u.pathname === "/api/v1/items/50000001", body: thread },
];

async function fetchFixtureJobs() {
  const http = createFakeHttp(routes);
  return { http, jobs: await createHnSource({ http }).fetchJobs() };
}

describe("parseHeader", () => {
  it.each([
    [
      "Acme (Remote US) — Full-Stack Engineer — TypeScript / React",
      { company: "Acme", roles: ["Full-Stack Engineer"], location: "Remote US" },
    ],
    [
      "Acme | ONSITE | San Francisco, CA & New York City, NY",
      {
        company: "Acme",
        roles: [UNKNOWN_TITLE],
        location: "San Francisco, CA & New York City, NY; ONSITE",
      },
    ],
    [
      "Acme | Senior SWE, R&D Engineer | REMOTE (US Timezones) | $170k to $230k",
      { company: "Acme", roles: ["Senior SWE", "R&D Engineer"], location: "REMOTE (US Timezones)" },
    ],
    [
      "Acme | Product Engineer (Design) & Platform Engineer | ONSITE in London, UK",
      {
        company: "Acme",
        roles: ["Product Engineer (Design)", "Platform Engineer"],
        location: "ONSITE in London, UK",
      },
    ],
    [
      "Acme | Multiple Engineering, Data, Revenue, and Ops Roles | NYC",
      {
        company: "Acme",
        roles: ["Multiple Engineering, Data, Revenue, and Ops Roles"],
        location: "NYC",
      },
    ],
    [
      "Acme https://acme.example | London, UK | https://acme.example/about",
      { company: "Acme", roles: [UNKNOWN_TITLE], location: "London, UK" },
    ],
  ])("%s", (line, expected) => {
    expect(parseHeader(line)).toEqual(expected);
  });

  it("does not take a salary segment as the role", () => {
    expect(
      parseHeader("Acme | $130-240K (depending on role) | Frontend Engineer | NYC")?.roles,
    ).toEqual(["Frontend Engineer"]);
  });

  it("rejects lines that aren't job headers", () => {
    expect(parseHeader("there used to be way more posts here :(")).toBeNull();
  });
});

describe("createHnSource", () => {
  it("uses the latest 'Who is hiring?' thread, not 'Who wants to be hired?'", async () => {
    const { http } = await fetchFixtureJobs();
    expect(http.requests.map((u) => u.pathname)).toEqual([
      "/api/v1/search_by_date",
      "/api/v1/items/50000001",
    ]);
    expect(http.requests[0]?.searchParams.get("tags")).toBe("story,author_whoishiring");
  });

  it("maps a post to a Job", async () => {
    const { jobs } = await fetchFixtureJobs();

    expect(jobs[0]).toMatchObject({
      source: "HN_HIRING",
      externalId: "50000101",
      url: "https://news.ycombinator.com/item?id=50000101",
      applyUrl: "https://boards.greenhouse.io/northwind/jobs/4012345",
      title: "Full-Stack Engineer",
      companyName: "Northwind",
      location: "Remote US",
      workplaceType: "REMOTE",
      descriptionTruncated: false,
      postedAt: new Date("2026-11-02T16:01:00.000Z"),
    });
    expect(jobs[0]?.description).toContain("We build tools for teachers.");
  });

  it("splits multi-role posts into one Job per role", async () => {
    const { jobs } = await fetchFixtureJobs();
    const fabrikam = jobs.filter((j) => j.companyName === "Fabrikam");

    expect(fabrikam.map((j) => [j.externalId, j.title])).toEqual([
      ["50000103#0", "Senior Frontend Engineer"],
      ["50000103#1", "Backend Engineer"],
    ]);
    // Prefers the ATS link over the homepage that appears first.
    expect(fabrikam[0]?.applyUrl).toBe("https://jobs.lever.co/fabrikam");
  });

  it("keeps a team name as part of a single title", async () => {
    const { jobs } = await fetchFixtureJobs();
    expect(jobs.find((j) => j.companyName === "Initech")).toMatchObject({
      title: "Software Engineer, Payments",
      location: "Hybrid - Jersey City, NJ",
      workplaceType: "HYBRID",
    });
  });

  it("keeps posts with no stated role", async () => {
    const { jobs } = await fetchFixtureJobs();
    expect(jobs.find((j) => j.companyName === "Contoso")).toMatchObject({
      title: UNKNOWN_TITLE,
      location: "New York, NY; ONSITE",
      workplaceType: "ONSITE",
    });
  });

  it("skips replies, meta comments, and deleted comments", async () => {
    const { jobs } = await fetchFixtureJobs();
    expect(new Set(jobs.map((j) => j.companyName))).toEqual(
      new Set(["Northwind", "Contoso", "Fabrikam", "Initech"]),
    );
  });

  it("fails loudly when there is no hiring thread", async () => {
    const http = createFakeHttp([
      { match: (u) => u.pathname === "/api/v1/search_by_date", body: { hits: [] } },
    ]);
    await expect(createHnSource({ http }).fetchJobs()).rejects.toThrow(/No 'Ask HN/);
  });
});
