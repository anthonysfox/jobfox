import type { EmploymentType, WorkplaceType } from "../core/job.ts";

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

// A label or title can say "Contract" outright. "Temp" is left out: it's also short for temperature.
const CONTRACT_WORD =
  /\b(contract|contractor|contract to hire|c2h|c2c|corp to corp|1099|freelance|freelancer|temporary)\b/;
const PERMANENT_LABEL = /\b(full ?time|part ?time|permanent|regular|direct hire|fte)\b/;
// Descriptions need a phrase, since "smart contracts" and "government contracts" come up often.
const CONTRACT_PHRASE = new RegExp(
  [
    "contract to hire",
    "c2h",
    "c2c",
    "corp to corp",
    "1099",
    "w ?2 contract",
    "(?:is|as|on) an? (?:temporary |freelance |short term |long term )?contract(?:or)?",
    "contract (?:role|position|opportunity|assignment|engagement|basis|length|duration|term)",
    "\\d+\\+? ?months? (?:contract|engagement|assignment)",
    "freelance (?:role|position|basis|engagement)",
    "temporary (?:role|position|assignment)",
  ]
    .map((p) => `\\b(?:${p})\\b`)
    .join("|"),
);

/** Lowercase with hyphens, underscores, and camel case turned into spaces: "FullTime" -> "full time". */
function employmentText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[-_]/g, " ");
}

/**
 * The source's own label ("Contract", "FullTime", "permanent") wins. Then the
 * title, then specific phrases in the description. Silence means UNKNOWN, not permanent.
 */
export function inferEmploymentType(job: {
  label?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
}): EmploymentType {
  const label = employmentText(job.label ?? "");
  if (CONTRACT_WORD.test(label)) return "CONTRACT";
  if (PERMANENT_LABEL.test(label)) return "PERMANENT";
  if (CONTRACT_WORD.test(employmentText(job.title))) return "CONTRACT";
  if (CONTRACT_PHRASE.test(employmentText(job.description ?? ""))) return "CONTRACT";
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
