import type { Job } from "../core/job.js";

let counter = 0;

/** Build a Job with sensible defaults so tests only spell out what matters. */
export function makeJob(overrides: Partial<Job> = {}): Job {
  counter++;
  return {
    source: "ADZUNA",
    externalId: `job-${counter}`,
    url: `https://example.com/jobs/${counter}`,
    applyUrl: null,
    title: "Full Stack Engineer",
    companyName: "Acme",
    location: "New York, NY",
    workplaceType: "UNKNOWN",
    description: null,
    descriptionTruncated: false,
    salary: null,
    postedAt: null,
    raw: {},
    ...overrides,
  };
}
