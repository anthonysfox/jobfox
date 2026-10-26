import type { FilterConfig } from "../core/config.ts";
import { UNKNOWN_TITLE } from "../core/job.ts";
import {
  containsPhrase,
  normalizeCompany,
  normalizeTitle,
  toPhraseText,
} from "../lib/normalize.ts";
import type { CanonicalJob } from "./dedupe.ts";

type FilterableJob = Pick<CanonicalJob, "companyName" | "title" | "location" | "workplaceType">;

/** Title matching goes through the same aliases as dedupe, so "Fullstack" matches "full stack". */
function titleHas(title: string, phrase: string): boolean {
  return containsPhrase(normalizeTitle(title), normalizeTitle(phrase));
}

const WORKPLACE_WORDS = /\b(remote|hybrid|onsite|on site|in office|first|only|fully|or|and)\b/g;
const US_ELIGIBLE =
  /\b(us|usa|united states|america|north america|global|worldwide|anywhere|est|et|eastern|pst|pt|pacific|cst|ct|central|mountain)\b/;
const US_STATE = /, ?[A-Z]{2}\b/;

/**
 * A remote job counts as US-eligible when it names nowhere ("Remote"), names
 * the US or a US time zone, says global, or gives a "City, ST" location.
 */
function isUsEligible(location: string): boolean {
  const text = toPhraseText(location).replace(WORKPLACE_WORDS, "").trim();
  return !text || US_ELIGIBLE.test(text) || US_STATE.test(location);
}

function checkLocation(job: FilterableJob, filters: FilterConfig): string | null {
  const location = job.location ?? "";
  const isRemote = job.workplaceType === "REMOTE" || /\bremote\b/i.test(location);

  if (filters.locations.some((place) => containsPhrase(location, place))) return null;

  if (isRemote) {
    if (!filters.remoteOk) return "remote:not-allowed";
    const region = filters.remoteExcludedRegions.find(
      (r) => containsPhrase(location, r) || containsPhrase(job.title, r),
    );
    if (region) return `remote:region:${region}`;
    return filters.remoteUsOnly && !isUsEligible(location) ? "remote:outside-us" : null;
  }

  // Unknown location: keep it and let me decide in review rather than drop it silently.
  if (!location.trim()) return null;

  return "location:not-allowed";
}

/** Returns why a job fails the hard filters. An empty array means it passed. */
export function rejectReasons(job: FilterableJob, filters: FilterConfig): string[] {
  const reasons: string[] = [];

  const company = normalizeCompany(job.companyName);
  if (filters.companyBlocklist.some((blocked) => normalizeCompany(blocked) === company)) {
    reasons.push("company:blocklisted");
  }

  for (const phrase of filters.seniorityExclude) {
    if (titleHas(job.title, phrase)) reasons.push(`seniority:${phrase}`);
  }

  // Like unknown locations, an unknown title goes to review instead of being rejected.
  if (
    job.title !== UNKNOWN_TITLE &&
    filters.titleKeywords.length > 0 &&
    !filters.titleKeywords.some((keyword) => titleHas(job.title, keyword))
  ) {
    reasons.push("title:no-keyword-match");
  }

  const locationReason = checkLocation(job, filters);
  if (locationReason) reasons.push(locationReason);

  return reasons;
}
