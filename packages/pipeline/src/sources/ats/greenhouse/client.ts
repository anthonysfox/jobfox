import type { Job } from "../../../core/job.ts";
import { decodeEntities, htmlToText } from "../../../lib/html.ts";
import { HttpError, type HttpClient } from "../../../lib/http.ts";
import { inferWorkplaceType } from "../../../lib/normalize.ts";
import type { AtsBoard, AtsClient } from "../types.ts";
import { greenhouseJobSchema, greenhouseJobsResponseSchema, type GreenhouseJob } from "./schema.ts";

// https://developers.greenhouse.io/job-board.html

export const GREENHOUSE_API_HOST = "boards-api.greenhouse.io";

export function toJob(job: GreenhouseJob, board: AtsBoard): Job {
  // Decode once to get real HTML, then convert that HTML to text.
  const description = htmlToText(decodeEntities(job.content));
  const location = job.location?.name ?? null;

  return {
    source: "GREENHOUSE",
    externalId: String(job.id),
    url: job.absolute_url,
    applyUrl: job.absolute_url,
    title: job.title,
    companyName: board.companyName,
    location,
    workplaceType: inferWorkplaceType(job.title, location, description),
    description: description || null,
    descriptionTruncated: false,
    salary: null,
    postedAt: new Date(job.first_published ?? job.updated_at),
    raw: job,
  };
}

function boardUrl(board: AtsBoard, path = ""): URL {
  return new URL(`https://${GREENHOUSE_API_HOST}/v1/boards/${board.slug}/jobs${path}`);
}

export async function listGreenhouseJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  const url = boardUrl(board);
  url.searchParams.set("content", "true");

  const { jobs } = await http.getJson(url, greenhouseJobsResponseSchema);
  return jobs.map((job) => toJob(job, board));
}

export async function getGreenhouseJob(
  http: HttpClient,
  board: AtsBoard,
  jobId: string,
): Promise<Job | null> {
  try {
    return toJob(await http.getJson(boardUrl(board, `/${jobId}`), greenhouseJobSchema), board);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export const greenhouseClient: AtsClient = {
  listJobs: listGreenhouseJobs,
  getJob: getGreenhouseJob,
};
