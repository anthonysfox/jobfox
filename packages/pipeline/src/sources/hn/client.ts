import type { HttpClient } from "../../lib/http.ts";
import { storySearchSchema, threadSchema, type HnThread } from "./schema.ts";

export const HN_ALGOLIA_HOST = "hn.algolia.com";

const HIRING_TITLE = /^Ask HN: Who is hiring\?/i;

/**
 * The whoishiring account posts "Who is hiring?", "Who wants to be hired?",
 * and "Freelancer?" at the same moment, so match on the title, not the date.
 */
export async function findLatestHiringThreadId(http: HttpClient): Promise<string | null> {
  const url = new URL(`https://${HN_ALGOLIA_HOST}/api/v1/search_by_date`);
  url.searchParams.set("tags", "story,author_whoishiring");
  url.searchParams.set("hitsPerPage", "10");

  const { hits } = await http.getJson(url, storySearchSchema);
  return hits.find((hit) => HIRING_TITLE.test(hit.title ?? ""))?.objectID ?? null;
}

export function fetchThread(http: HttpClient, id: string): Promise<HnThread> {
  return http.getJson(`https://${HN_ALGOLIA_HOST}/api/v1/items/${id}`, threadSchema);
}
