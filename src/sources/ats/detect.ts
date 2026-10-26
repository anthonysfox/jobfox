import type { Ats } from "../../core/job.js";

export interface AtsRef {
  ats: Ats;
  slug: string;
  /** Null when the URL points at the whole board rather than one job. */
  jobId: string | null;
}

const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectGreenhouse(url: URL): AtsRef | null {
  if (!GREENHOUSE_HOSTS.has(url.hostname)) return null;
  const [first, second, third] = url.pathname.split("/").filter(Boolean);

  // Embedded boards: /embed/job_app?for=acme&token=123 or /embed/job_board?for=acme
  if (first === "embed") {
    const slug = url.searchParams.get("for");
    return slug ? { ats: "GREENHOUSE", slug, jobId: url.searchParams.get("token") } : null;
  }
  if (!first) return null;
  const jobId = second === "jobs" && third && /^\d+$/.test(third) ? third : null;
  return { ats: "GREENHOUSE", slug: first, jobId };
}

// EU-hosted Lever boards (jobs.eu.lever.co) use a different API host, so they're not matched yet.
function detectLever(url: URL): AtsRef | null {
  if (url.hostname !== "jobs.lever.co") return null;
  const [slug, id] = url.pathname.split("/").filter(Boolean);
  if (!slug) return null;
  return { ats: "LEVER", slug, jobId: id && UUID.test(id) ? id : null };
}

function detectAshby(url: URL): AtsRef | null {
  if (url.hostname !== "jobs.ashbyhq.com") return null;
  const [slug, id] = url.pathname.split("/").filter(Boolean);
  if (!slug) return null;
  return { ats: "ASHBY", slug, jobId: id && UUID.test(id) ? id : null };
}

/** Recognize a Greenhouse, Lever, or Ashby job (or board) URL. */
export function detectAts(input: string): AtsRef | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  return detectGreenhouse(url) ?? detectLever(url) ?? detectAshby(url);
}
