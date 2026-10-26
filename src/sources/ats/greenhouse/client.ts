/* eslint-disable @typescript-eslint/no-unused-vars -- stub; delete this line once implemented */
import type { Job } from "../../../core/job.js";
import type { HttpClient } from "../../../lib/http.js";
import { NotImplementedError, type AtsBoard, type AtsClient } from "../types.js";

/*
 * TODO(you): Greenhouse Job Board API client.
 * Docs: https://developers.greenhouse.io/job-board.html
 *
 *   List:   GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 *   Single: GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
 *
 * Follow the Adzuna source: schema.ts (Zod) -> client.ts (URL + http.getJson)
 * -> a toJob() mapping into the shared Job type (src/sources/adzuna/source.ts).
 * Helpers you'll want: htmlToText / decodeEntities (src/lib/html.ts),
 * inferWorkplaceType (src/lib/normalize.ts), HttpError (src/lib/http.ts).
 *
 * The spec is greenhouse.test.ts. Run `pnpm test greenhouse` until it's green.
 */

export const GREENHOUSE_API_HOST = "boards-api.greenhouse.io";

export function listGreenhouseJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  return Promise.reject(new NotImplementedError("listGreenhouseJobs"));
}

export function getGreenhouseJob(
  http: HttpClient,
  board: AtsBoard,
  jobId: string,
): Promise<Job | null> {
  return Promise.reject(new NotImplementedError("getGreenhouseJob"));
}

export const greenhouseClient: AtsClient = {
  listJobs: listGreenhouseJobs,
  getJob: getGreenhouseJob,
};
