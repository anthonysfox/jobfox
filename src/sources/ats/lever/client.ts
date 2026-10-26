/* eslint-disable @typescript-eslint/no-unused-vars -- stub; delete this line once implemented */
import type { Job } from "../../../core/job.js";
import type { HttpClient } from "../../../lib/http.js";
import { NotImplementedError, type AtsBoard, type AtsClient } from "../types.js";

/*
 * TODO(you): Lever Postings API client.
 * Docs: https://github.com/lever/postings-api
 *
 *   List:   GET https://api.lever.co/v0/postings/{site}?mode=json
 *   Single: GET https://api.lever.co/v0/postings/{site}/{posting_id}?mode=json
 *
 * Follow the Adzuna source: schema.ts (Zod) -> client.ts (URL + http.getJson)
 * -> a toJob() mapping into the shared Job type (src/sources/adzuna/source.ts).
 * Helpers you'll want: htmlToText (src/lib/html.ts), HttpError (src/lib/http.ts).
 *
 * The spec is lever.test.ts. Run `pnpm test lever` until it's green.
 */

export const LEVER_API_HOST = "api.lever.co";

export function listLeverJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  return Promise.reject(new NotImplementedError("listLeverJobs"));
}

export function getLeverJob(
  http: HttpClient,
  board: AtsBoard,
  postingId: string,
): Promise<Job | null> {
  return Promise.reject(new NotImplementedError("getLeverJob"));
}

export const leverClient: AtsClient = {
  listJobs: listLeverJobs,
  getJob: getLeverJob,
};
