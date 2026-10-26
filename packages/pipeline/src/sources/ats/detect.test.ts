import { describe, expect, it } from "vitest";
import { detectAts } from "./detect.ts";

describe("detectAts", () => {
  it.each([
    [
      "https://boards.greenhouse.io/northwind/jobs/4012345",
      { ats: "GREENHOUSE", slug: "northwind", jobId: "4012345" },
    ],
    [
      "https://job-boards.greenhouse.io/northwind/jobs/4012345?gh_src=hn",
      { ats: "GREENHOUSE", slug: "northwind", jobId: "4012345" },
    ],
    [
      "https://boards.greenhouse.io/northwind",
      { ats: "GREENHOUSE", slug: "northwind", jobId: null },
    ],
    [
      "https://boards.greenhouse.io/embed/job_app?for=northwind&token=4012345",
      { ats: "GREENHOUSE", slug: "northwind", jobId: "4012345" },
    ],
    [
      "https://jobs.lever.co/fabrikam/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
      { ats: "LEVER", slug: "fabrikam", jobId: "5ac21346-8e0c-4494-8e7a-3eb92ff77902" },
    ],
    [
      "https://jobs.lever.co/fabrikam/5ac21346-8e0c-4494-8e7a-3eb92ff77902/apply",
      { ats: "LEVER", slug: "fabrikam", jobId: "5ac21346-8e0c-4494-8e7a-3eb92ff77902" },
    ],
    ["https://jobs.lever.co/fabrikam", { ats: "LEVER", slug: "fabrikam", jobId: null }],
    [
      "https://jobs.ashbyhq.com/contoso/2efae53b-817c-43e7-9da3-72694813f608",
      { ats: "ASHBY", slug: "contoso", jobId: "2efae53b-817c-43e7-9da3-72694813f608" },
    ],
    [
      "https://jobs.ashbyhq.com/contoso?utm_source=hn",
      { ats: "ASHBY", slug: "contoso", jobId: null },
    ],
  ])("%s", (url, expected) => {
    expect(detectAts(url)).toEqual(expected);
  });

  it.each([
    "https://contoso.example/careers",
    "https://boards.greenhouse.io/",
    "https://jobs.eu.lever.co/acme/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
    "https://www.adzuna.com/land/ad/123",
    "not a url",
  ])("ignores %s", (url) => {
    expect(detectAts(url)).toBeNull();
  });
});
