/* eslint-disable @typescript-eslint/no-unused-vars -- stub; delete this line once implemented */
import type { Job } from "../../../core/job.js";
import type { HttpClient } from "../../../lib/http.js";
import { NotImplementedError, type AtsBoard, type AtsClient } from "../types.js";

/*
 * TODO(you): Ashby public job posting API client.
 * Docs: https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 *   List: GET https://api.ashbyhq.com/posting-api/job-board/{job_board_name}?includeCompensation=true
 *
 * There's no single-job endpoint, so getAshbyJob fetches the board and finds the job.
 *
 * Follow the Adzuna source: schema.ts (Zod) -> client.ts (URL + http.getJson)
 * -> a toJob() mapping into the shared Job type (src/sources/adzuna/source.ts).
 * Helpers you'll want: inferWorkplaceType (src/lib/normalize.ts).
 *
 * The spec is ashby.test.ts. Run `pnpm test ashby` until it's green.
 */

export const ASHBY_API_HOST = "api.ashbyhq.com";

export function listAshbyJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  return Promise.reject(new NotImplementedError("listAshbyJobs"));
}

export function getAshbyJob(http: HttpClient, board: AtsBoard, jobId: string): Promise<Job | null> {
  return Promise.reject(new NotImplementedError("getAshbyJob"));
}

export const ashbyClient: AtsClient = {
  listJobs: listAshbyJobs,
  getJob: getAshbyJob,
};
