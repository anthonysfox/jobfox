import type { Ats } from "../core/job.ts";
import { extractUrls } from "../lib/html.ts";
import type { HttpClient } from "../lib/http.ts";
import { detectAts, type AtsRef } from "../sources/ats/detect.ts";
import { NotImplementedError, type AtsClient } from "../sources/ats/types.ts";
import { isAtsSource, type JobGroup } from "./dedupe.ts";

/*
 * Find a Greenhouse/Lever/Ashby link for a group, fetch the full posting, and
 * report the board so the company gets polled directly on future runs.
 *
 * Adzuna's redirect_url is deliberately NOT followed. Those are tracked clicks
 * that advertisers may pay for, so resolving them by script would inflate
 * their numbers and likely break Adzuna's terms. Adzuna jobs get upgraded when
 * dedupe merges them with an HN post or a polled ATS board instead.
 */

/** Link shorteners owned by an ATS, safe to resolve. */
const ATS_SHORTLINK_HOSTS = new Set(["grnh.se"]);

export interface EnrichDeps {
  http: HttpClient;
  clients: Record<Ats, AtsClient>;
}

export interface EnrichOutcome {
  /** The ATS board found for this company, if any. */
  board: AtsRef | null;
  /** Whether a full ATS posting was added to the group. */
  attached: boolean;
  /** Set when the matching ATS client isn't implemented yet. */
  notImplemented: Ats | null;
  error: string | null;
}

const NOTHING: EnrichOutcome = { board: null, attached: false, notImplemented: null, error: null };

export function candidateUrls(group: JobGroup): string[] {
  const urls = group.postings.flatMap((p) => [
    ...(p.applyUrl ? [p.applyUrl] : []),
    // HN posts often link the homepage first and the ATS later in the body.
    ...(p.source === "HN_HIRING" && p.description ? extractUrls(p.description) : []),
  ]);
  return [...new Set(urls)];
}

async function findAtsRef(group: JobGroup, http: HttpClient): Promise<AtsRef | null> {
  for (const url of candidateUrls(group)) {
    const ref = detectAts(url);
    if (ref) return ref;
    if (ATS_SHORTLINK_HOSTS.has(new URL(url).hostname)) {
      const resolved = detectAts(await http.resolveRedirects(url));
      if (resolved) return resolved;
    }
  }
  return null;
}

export async function enrichGroup(
  group: JobGroup,
  companyName: string,
  { http, clients }: EnrichDeps,
): Promise<EnrichOutcome> {
  if (group.postings.some((p) => isAtsSource(p.source))) return NOTHING;

  let board: AtsRef | null;
  try {
    board = await findAtsRef(group, http);
  } catch (error) {
    return { ...NOTHING, error: String(error) };
  }
  if (!board) return NOTHING;

  // A post listing several roles can't tell us which ATS job is which; the
  // board gets polled next run instead.
  const fromMultiRolePost = group.postings.some((p) => p.externalId.includes("#"));
  if (!board.jobId || fromMultiRolePost) return { ...NOTHING, board };

  try {
    const job = await clients[board.ats].getJob(
      http,
      { slug: board.slug, companyName },
      board.jobId,
    );
    if (job) group.postings.push(job);
    return { ...NOTHING, board, attached: job !== null };
  } catch (error) {
    if (error instanceof NotImplementedError) {
      return { ...NOTHING, board, notImplemented: board.ats };
    }
    return { ...NOTHING, board, error: String(error) };
  }
}
