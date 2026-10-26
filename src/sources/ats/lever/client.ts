import type { Job, WorkplaceType } from "../../../core/job.js";
import { htmlToText } from "../../../lib/html.js";
import { HttpError, type HttpClient } from "../../../lib/http.js";
import { inferWorkplaceType } from "../../../lib/normalize.js";
import type { AtsBoard, AtsClient } from "../types.js";
import { leverPostingSchema, leverPostingsResponseSchema, type LeverPosting } from "./schema.js";

// https://github.com/lever/postings-api

export const LEVER_API_HOST = "api.lever.co";

const WORKPLACE_TYPES: Record<string, WorkplaceType> = {
  onsite: "ONSITE",
  hybrid: "HYBRID",
  remote: "REMOTE",
};

/** Lever splits a posting into an intro, titled lists (HTML), and a closing section. */
function buildDescription(posting: LeverPosting): string {
  const lists = posting.lists.map((list) => `${list.text.trim()}\n${htmlToText(list.content)}`);
  return [posting.descriptionPlain, ...lists, posting.additionalPlain]
    .map((section) => section.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function toJob(posting: LeverPosting, board: AtsBoard): Job {
  const location = posting.categories.location ?? null;
  const description = buildDescription(posting);

  return {
    source: "LEVER",
    externalId: posting.id,
    url: posting.hostedUrl,
    applyUrl: posting.applyUrl,
    title: posting.text,
    // Lever doesn't return a company name.
    companyName: board.companyName,
    location,
    workplaceType:
      WORKPLACE_TYPES[posting.workplaceType ?? ""] ?? inferWorkplaceType(posting.text, location),
    description: description || null,
    descriptionTruncated: false,
    salary: posting.salaryRange
      ? {
          min: posting.salaryRange.min,
          max: posting.salaryRange.max,
          currency: posting.salaryRange.currency,
        }
      : null,
    postedAt: new Date(posting.createdAt),
    raw: posting,
  };
}

function postingsUrl(board: AtsBoard, path = ""): URL {
  const url = new URL(`https://${LEVER_API_HOST}/v0/postings/${board.slug}${path}`);
  url.searchParams.set("mode", "json");
  return url;
}

export async function listLeverJobs(http: HttpClient, board: AtsBoard): Promise<Job[]> {
  const postings = await http.getJson(postingsUrl(board), leverPostingsResponseSchema);
  return postings.map((posting) => toJob(posting, board));
}

export async function getLeverJob(
  http: HttpClient,
  board: AtsBoard,
  postingId: string,
): Promise<Job | null> {
  try {
    return toJob(
      await http.getJson(postingsUrl(board, `/${postingId}`), leverPostingSchema),
      board,
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export const leverClient: AtsClient = {
  listJobs: listLeverJobs,
  getJob: getLeverJob,
};
