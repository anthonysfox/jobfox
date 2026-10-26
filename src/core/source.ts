import type { Job } from "./job.js";

/**
 * Every job source implements this. Dependencies (HTTP client, credentials,
 * search terms) go in through the source's factory, so `fetchJobs` stays
 * argument-free and the discover script can treat all sources the same way.
 */
export interface JobSource {
  /** Name for logs and the run summary, e.g. "adzuna" or "greenhouse:stripe". */
  readonly name: string;
  fetchJobs(): Promise<Job[]>;
}
