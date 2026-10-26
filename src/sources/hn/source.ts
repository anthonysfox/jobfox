import type { JobSource } from "../../core/source.js";
import type { HttpClient } from "../../lib/http.js";
import { fetchThread, findLatestHiringThreadId } from "./client.js";
import { parseHiringComment } from "./parse.js";

export function createHnSource({ http }: { http: HttpClient }): JobSource {
  return {
    name: "hn",
    async fetchJobs() {
      const threadId = await findLatestHiringThreadId(http);
      if (!threadId) throw new Error("No 'Ask HN: Who is hiring?' thread found");

      const thread = await fetchThread(http, threadId);
      return thread.children.flatMap(parseHiringComment);
    },
  };
}
