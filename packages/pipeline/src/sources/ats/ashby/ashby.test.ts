import { describe, expect, it } from "vitest";
import { createFakeHttp } from "../../../test/fake-http.ts";
import jobBoard from "./fixtures/job-board.json" with { type: "json" };
import { getAshbyJob, listAshbyJobs } from "./client.ts";

const board = { slug: "contoso", companyName: "Contoso" };
const ID = "2efae53b-817c-43e7-9da3-72694813f608";
const BOARD_URL = "https://api.ashbyhq.com/posting-api/job-board/contoso?includeCompensation=true";

const http = () => createFakeHttp([{ match: (u) => u.toString() === BOARD_URL, body: jobBoard }]);

describe("listAshbyJobs", () => {
  it("requests the job board with compensation", async () => {
    const fake = http();
    await listAshbyJobs(fake, board);
    expect(fake.requests.map(String)).toEqual([BOARD_URL]);
  });

  it("maps each job to the shared Job type", async () => {
    const [job] = await listAshbyJobs(http(), board);

    expect(job).toMatchObject({
      source: "ASHBY",
      externalId: ID,
      url: `https://jobs.ashbyhq.com/contoso/${ID}`,
      applyUrl: `https://jobs.ashbyhq.com/contoso/${ID}/application`,
      title: "Product Engineer",
      companyName: "Contoso",
      location: "New York",
      workplaceType: "HYBRID",
      description: "Contoso builds logistics software.\n\n- TypeScript",
      descriptionTruncated: false,
      // From the "Salary" summary component; equity is ignored.
      salary: { min: 140000, max: 180000, currency: "USD" },
      postedAt: new Date("2026-10-15T14:00:00.000Z"),
    });
  });

  it("maps remote jobs and missing compensation", async () => {
    const [, job] = await listAshbyJobs(http(), board);

    expect(job?.workplaceType).toBe("REMOTE");
    expect(job?.salary).toBeNull();
  });

  it("skips unlisted jobs", async () => {
    const jobs = await listAshbyJobs(http(), board);
    expect(jobs.map((j) => j.title)).toEqual(["Product Engineer", "Solutions Engineer"]);
  });
});

describe("getAshbyJob", () => {
  it("finds one job on the board (Ashby has no single-job endpoint)", async () => {
    const job = await getAshbyJob(http(), board, ID);
    expect(job?.title).toBe("Product Engineer");
  });

  it("returns null when the job isn't on the board", async () => {
    await expect(
      getAshbyJob(http(), board, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });
});
