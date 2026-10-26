import type { Job, WorkplaceType } from "../../../core/job.js";
import type { HttpClient } from "../../../lib/http.js";
import { inferWorkplaceType } from "../../../lib/normalize.js";
import type { AtsBoard, AtsClient } from "../types.js";
import { ashbyJobBoardResponseSchema, type AshbyJob } from "./schema.js";

// https://developers.ashbyhq.com/docs/public-job-posting-api

export const ASHBY_API_HOST = "api.ashbyhq.com";

const WORKPLACE_TYPES: Record<string, WorkplaceType> = {
  OnSite: "ONSITE",
  Hybrid: "HYBRID",
  Remote: "REMOTE",
};

export function toJob(job: AshbyJob, board: AtsBoard): Job {
  const location = job.location ?? null;
  const salary = job.compensation?.summaryComponents.find((c) => c.compensationType === "Salary");

  return {
    source: "ASHBY",
    externalId: job.id,
    url: job.jobUrl,
    applyUrl: job.applyUrl,
    title: job.title,
    companyName: board.companyName,
    location,
    workplaceType:
      WORKPLACE_TYPES[job.workplaceType ?? ""] ?? inferWorkplaceType(job.title, location),
    description: job.descriptionPlain ?? null,
    descriptionTruncated: false,
    salary: salary
      ? { min: salary.minValue, max: salary.maxValue, currency: salary.currencyCode ?? null }
      : null,
    postedAt: new Date(job.publishedAt),
    raw: job,
  };
}

export async function listAshbyJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  const url = new URL(`https://${ASHBY_API_HOST}/posting-api/job-board/${board.slug}`);
  url.searchParams.set("includeCompensation", "true");

  const { jobs } = await http.getJson(url, ashbyJobBoardResponseSchema);
  return jobs.filter((job) => job.isListed).map((job) => toJob(job, board));
}

/** Ashby has no single-job endpoint, so look the job up on the board. */
export async function getAshbyJob(
  http: HttpClient,
  board: AtsBoard,
  jobId: string,
): Promise<Job | null> {
  const jobs = await listAshbyJobs(http, board);
  return jobs.find((job) => job.externalId === jobId) ?? null;
}

export const ashbyClient: AtsClient = {
  listJobs: listAshbyJobs,
  getJob: getAshbyJob,
};
