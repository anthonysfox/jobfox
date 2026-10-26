import { describe, expect, it } from "vitest";
import { createFakeHttp } from "../../../test/fake-http.ts";
import jobs from "./fixtures/jobs.json" with { type: "json" };
import { getGreenhouseJob, listGreenhouseJobs } from "./client.ts";

const board = { slug: "northwind", companyName: "Northwind" };
const LIST_URL = "https://boards-api.greenhouse.io/v1/boards/northwind/jobs?content=true";
const JOB_URL = "https://boards-api.greenhouse.io/v1/boards/northwind/jobs/4012345";

const http = () =>
  createFakeHttp([
    { match: (u) => u.toString() === LIST_URL, body: jobs },
    { match: (u) => u.toString() === JOB_URL, body: jobs.jobs[0] },
  ]);

describe("listGreenhouseJobs", () => {
  it("requests the board's jobs with content", async () => {
    const fake = http();
    await listGreenhouseJobs(fake, board);
    expect(fake.requests.map(String)).toEqual([LIST_URL]);
  });

  it("maps each job to the shared Job type", async () => {
    const [job] = await listGreenhouseJobs(http(), board);

    expect(job).toMatchObject({
      source: "GREENHOUSE",
      externalId: "4012345",
      url: "https://job-boards.greenhouse.io/northwind/jobs/4012345",
      applyUrl: "https://job-boards.greenhouse.io/northwind/jobs/4012345",
      title: "Full-Stack Engineer",
      companyName: "Northwind",
      location: "New York, NY",
      workplaceType: "HYBRID",
      descriptionTruncated: false,
      salary: null,
      postedAt: new Date("2026-10-01T13:00:00.000Z"),
    });
  });

  it("turns Greenhouse's entity-escaped HTML into plain text", async () => {
    const [job] = await listGreenhouseJobs(http(), board);

    expect(job?.description).toContain("We build tools for teachers.");
    expect(job?.description).toContain("TypeScript & React");
    expect(job?.description).not.toMatch(/<|&lt;|&amp;/);
  });

  it("falls back to updated_at when first_published is null", async () => {
    const [, job] = await listGreenhouseJobs(http(), board);

    expect(job?.postedAt).toEqual(new Date("2026-10-22T15:00:00.000Z"));
    expect(job?.workplaceType).toBe("REMOTE");
  });
});

describe("getGreenhouseJob", () => {
  it("fetches and maps a single job", async () => {
    const fake = http();
    const job = await getGreenhouseJob(fake, board, "4012345");

    expect(fake.requests.map(String)).toEqual([JOB_URL]);
    expect(job?.externalId).toBe("4012345");
  });

  it("returns null when the job is gone (404)", async () => {
    await expect(getGreenhouseJob(http(), board, "999")).resolves.toBeNull();
  });
});
