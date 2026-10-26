import { describe, expect, it } from "vitest";
import { createFakeHttp } from "../../../test/fake-http.js";
import postings from "./fixtures/postings.json" with { type: "json" };
import { getLeverJob, listLeverJobs } from "./client.js";

const board = { slug: "fabrikam", companyName: "Fabrikam" };
const ID = "5ac21346-8e0c-4494-8e7a-3eb92ff77902";
const LIST_URL = "https://api.lever.co/v0/postings/fabrikam?mode=json";
const JOB_URL = `https://api.lever.co/v0/postings/fabrikam/${ID}?mode=json`;

const http = () =>
  createFakeHttp([
    { match: (u) => u.toString() === LIST_URL, body: postings },
    { match: (u) => u.toString() === JOB_URL, body: postings[0] },
  ]);

describe("listLeverJobs", () => {
  it("requests the site's postings as JSON", async () => {
    const fake = http();
    await listLeverJobs(fake, board);
    expect(fake.requests.map(String)).toEqual([LIST_URL]);
  });

  it("maps each posting to the shared Job type", async () => {
    const [job] = await listLeverJobs(http(), board);

    expect(job).toMatchObject({
      source: "LEVER",
      externalId: ID,
      url: `https://jobs.lever.co/fabrikam/${ID}`,
      applyUrl: `https://jobs.lever.co/fabrikam/${ID}/apply`,
      title: "Senior Frontend Engineer",
      // Lever doesn't return a company name; it comes from the board.
      companyName: "Fabrikam",
      location: "New York, NY",
      workplaceType: "HYBRID",
      descriptionTruncated: false,
      salary: { min: 150000, max: 190000, currency: "USD" },
      // createdAt is epoch milliseconds.
      postedAt: new Date(1791900000000),
    });
  });

  it("builds the description from the intro, lists, and closing section", async () => {
    const [job] = await listLeverJobs(http(), board);

    expect(job?.description).toContain("Fabrikam makes invoicing painless.");
    expect(job?.description).toContain("Ship React features end to end");
    expect(job?.description).toContain("We offer great benefits.");
    expect(job?.description).not.toMatch(/<[a-z]/);
  });

  it("infers the workplace type when Lever says 'unspecified'", async () => {
    const [, job] = await listLeverJobs(http(), board);

    expect(job?.workplaceType).toBe("REMOTE");
    expect(job?.salary).toBeNull();
  });
});

describe("getLeverJob", () => {
  it("fetches and maps a single posting", async () => {
    const fake = http();
    const job = await getLeverJob(fake, board, ID);

    expect(fake.requests.map(String)).toEqual([JOB_URL]);
    expect(job?.externalId).toBe(ID);
  });

  it("returns null when the posting is gone (404)", async () => {
    await expect(
      getLeverJob(http(), board, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });
});
