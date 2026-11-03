/*
 * Checks on drafted bullets that don't depend on trusting the model: each
 * bullet names the resume or profile line it's based on, so code can confirm
 * that line exists and that the bullet didn't invent numbers.
 */

import { LIST_ITEM } from "../resume/entries.ts";

/** Lowercase words and numbers only, so Markdown, punctuation, and spacing don't matter. */
export function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Spelled-out counts, so "seven years" can't slip past a resume that says "Six years".
// "one" is left out: it's too common outside counts ("one of", "the one I'm proudest of").
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|hundreds|thousands|millions)\b/gi;

/**
 * Numbers as written, e.g. "40%", "$1.2M", "3", with thousands separators
 * dropped, plus spelled-out counts such as "six" and "hundreds", lowercased.
 */
export function numbersIn(text: string): string[] {
  return [
    ...[...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replaceAll(",", "")),
    ...[...text.matchAll(NUMBER_WORDS)].map((m) => m[0].toLowerCase()),
  ];
}

/** What the drafts may draw on. The profile is optional extra detail beyond the resume. */
export interface Facts {
  resume: string;
  profile: string;
  /** The resume's entries (see resumeEntries), where new bullets may go. */
  entries: string[];
}

export function bulletIssues(
  bullet: { text: string; source: string; entry?: string | undefined },
  facts: Facts,
): string[] {
  const issues: string[] = [];
  const source = comparable(bullet.source);
  const isAddition = bullet.entry !== undefined;

  // Rewrites replace a resume line, so their source must be on the resume.
  // New bullets may draw on the profile too.
  const searched = comparable(isAddition ? `${facts.resume}\n${facts.profile}` : facts.resume);
  if (source.length === 0 || !searched.includes(source)) {
    issues.push(
      isAddition
        ? "The source isn't in your resume or profile."
        : "The source line isn't in your resume.",
    );
  }
  if (
    bullet.entry !== undefined &&
    !facts.entries.some((e) => comparable(e) === comparable(bullet.entry ?? ""))
  ) {
    issues.push(`"${bullet.entry}" isn't a section of your resume.`);
  }

  if (isAddition) {
    const repeated = resumeBullets(facts.resume).find((line) => overlap(bullet.text, line) >= 0.5);
    if (repeated) issues.push(`It repeats a bullet already on your resume: "${repeated}"`);
  }
  return [...issues, ...numberIssues(bullet.text, facts)];
}

const COMMON = new Set(
  "the and for with from into onto that this their them they its our your plus both every each all any using used use across alongside about over under".split(
    " ",
  ),
);

function keyWords(text: string): Set<string> {
  return new Set(
    comparable(text)
      .split(" ")
      .filter((w) => w.length > 2 && !COMMON.has(w)),
  );
}

/**
 * Share of the shorter text's key words that the other also has. A new bullet
 * that mostly restates a resume bullet scores 0.6 or more; one with a new fact
 * stays under 0.45. The prompt asks for no repeats, but the model still wrote
 * them, so code checks.
 */
export function overlap(a: string, b: string): number {
  const [left, right] = [keyWords(a), keyWords(b)];
  const shared = [...left].filter((w) => right.has(w)).length;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

/** The resume's bullets, without skills lines ("- **Languages:** ..."). */
function resumeBullets(resume: string): string[] {
  return resume
    .split("\n")
    .map((line) => LIST_ITEM.exec(line)?.[2] ?? "")
    .filter((text) => text && !text.startsWith("**"));
}

// Compare against all the facts, so a number moved in from another line is fine.
function numberIssues(text: string, facts: Facts): string[] {
  const known = new Set(numbersIn(`${facts.resume}\n${facts.profile}`));
  const invented = [...new Set(numbersIn(text))].filter((n) => !known.has(n));
  return invented.length > 0
    ? [`Numbers not in your resume or profile: ${invented.join(", ")}.`]
    : [];
}

/** Longer than this and the summary crowds out bullets; mine is about 65 words. */
export const MAX_SUMMARY_WORDS = 80;

export interface SummarySentence {
  text: string;
  /** The resume or profile lines this sentence is based on. */
  sources: string[];
}

/**
 * A summary combines facts from several lines, so each sentence names its
 * own sources. That makes the number check strict: a figure must come from
 * the lines that sentence cites, so "hundreds of clients" can't move from the
 * app it describes onto a different claim.
 */
export function summaryIssues(sentences: SummarySentence[], facts: Facts): string[] {
  const issues: string[] = [];
  const searched = comparable(`${facts.resume}\n${facts.profile}`);
  sentences.forEach((sentence, i) => {
    const label = `Sentence ${i + 1}`;
    if (sentence.sources.length === 0) issues.push(`${label} doesn't say what it's based on.`);
    for (const source of sentence.sources) {
      if (!searched.includes(comparable(source))) {
        issues.push(`${label} cites a line that isn't in your resume or profile: "${source}"`);
      }
    }
    const cited = new Set(numbersIn(sentence.sources.join("\n")));
    const unsupported = [...new Set(numbersIn(sentence.text))].filter((n) => !cited.has(n));
    if (unsupported.length > 0) {
      issues.push(`${label} has numbers its sources don't: ${unsupported.join(", ")}.`);
    }
  });
  const words = sentences.flatMap((s) => s.text.split(/\s+/)).filter(Boolean).length;
  if (words > MAX_SUMMARY_WORDS) {
    issues.push(`It's ${words} words; keep it under ${MAX_SUMMARY_WORDS}.`);
  }
  return issues;
}

/** A note to a hiring manager gets skimmed; past this it's a cover letter. */
export const MAX_MESSAGE_WORDS = 150;

/** Subjects get cut off in inbox previews past about this many words. */
export const MAX_SUBJECT_WORDS = 10;

/** The message makes claims too, so it gets the same number check as the bullets. */
export function messageIssues(
  { subject, text }: { subject: string; text: string },
  facts: Facts,
): string[] {
  const words = text.split(/\s+/).filter(Boolean).length;
  const subjectWords = subject.split(/\s+/).filter(Boolean).length;
  return [
    ...(words > MAX_MESSAGE_WORDS
      ? [`It's ${words} words; keep it under ${MAX_MESSAGE_WORDS}.`]
      : []),
    ...(subjectWords > MAX_SUBJECT_WORDS
      ? [`The subject is ${subjectWords} words; keep it under ${MAX_SUBJECT_WORDS}.`]
      : []),
    ...numberIssues(`${subject}\n${text}`, facts),
  ];
}
