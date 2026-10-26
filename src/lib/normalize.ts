import type { WorkplaceType } from "../core/job.js";

/**
 * Lowercase, strip accents and punctuation, collapse whitespace.
 * "Full-Stack Engineer (NYC)" -> "full stack engineer nyc"
 */
export function toPhraseText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whole-word phrase match, so "staff" matches "Staff Engineer" but not "Staffing". */
export function containsPhrase(text: string, phrase: string): boolean {
  const needle = toPhraseText(phrase);
  return needle.length > 0 && ` ${toPhraseText(text)} `.includes(` ${needle} `);
}

function stripBracketed(text: string): string {
  return text.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
}

const COMPANY_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "plc",
  "gmbh",
]);

export function normalizeCompany(name: string): string {
  const words = toPhraseText(stripBracketed(name)).split(" ");
  if (words[0] === "the" && words.length > 1) words.shift();
  while (words.length > 1 && COMPANY_SUFFIXES.has(words.at(-1) ?? "")) words.pop();
  return words.join(" ");
}

const TITLE_ALIASES: [RegExp, string][] = [
  [/\bfull ?stack\b/g, "full stack"],
  [/\bfront ?end\b/g, "frontend"],
  [/\bback ?end\b/g, "backend"],
  [/\bsr\b/g, "senior"],
  [/\bjr\b/g, "junior"],
  [/\bswe\b/g, "software engineer"],
  [/\b(remote|hybrid|onsite|on site)\b/g, ""],
];

/**
 * Normalizes formatting only. Level markers ("II", "III") and team names stay,
 * because merging two different roles hides one from me; a duplicate is cheaper.
 */
export function normalizeTitle(title: string): string {
  let text = toPhraseText(stripBracketed(title));
  for (const [pattern, replacement] of TITLE_ALIASES) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, " ").trim();
}

const LOCATION_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  "new york ny": "new york",
  manhattan: "new york",
  brooklyn: "new york",
  "greater new york": "new york",
  "new york metropolitan": "new york",
  usa: "us",
  "united states": "us",
  "united states of america": "us",
};

/**
 * Reduce a location to its primary place, so "New York, NY", "NYC (Hybrid)" and
 * "New York City, New York" share a key. Anything starting with remote is "remote".
 */
export function normalizeLocation(location: string | null): string {
  if (!location) return "";
  const first = location.split(/[,;/|]| or /i)[0] ?? "";
  if (/\bremote\b/i.test(first)) return "remote";
  const text = toPhraseText(stripBracketed(first))
    .replace(/\b(hybrid|onsite|on site|in office)\b/g, "")
    .replace(/\b(area|metro)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return LOCATION_ALIASES[text] ?? text;
}

export function inferWorkplaceType(...texts: (string | null)[]): WorkplaceType {
  const text = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(text)) return "HYBRID";
  if (/\bremote\b/.test(text)) return "REMOTE";
  if (/\b(on-?site|in[- ]office|in[- ]person)\b/.test(text)) return "ONSITE";
  return "UNKNOWN";
}

export function dedupeKey(job: {
  companyName: string;
  title: string;
  location: string | null;
}): string {
  return [
    normalizeCompany(job.companyName),
    normalizeTitle(job.title),
    normalizeLocation(job.location),
  ].join("|");
}
