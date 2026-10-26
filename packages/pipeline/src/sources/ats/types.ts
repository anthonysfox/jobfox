import type { Job } from "../../core/job.ts";
import type { HttpClient } from "../../lib/http.ts";

/** A company's public job board on an ATS. */
export interface AtsBoard {
  /** Greenhouse board token, Lever site name, or Ashby job board name. */
  slug: string;
  /** Becomes Job.companyName. Lever's API doesn't return one, so we pass it in. */
  companyName: string;
}

/** Every ATS client exposes the same two operations. */
export interface AtsClient {
  /** All open jobs on the board. */
  listJobs(http: HttpClient, board: AtsBoard): Promise<Job[]>;
  /** One job, or null if it no longer exists. */
  getJob(http: HttpClient, board: AtsBoard, jobId: string): Promise<Job | null>;
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}
