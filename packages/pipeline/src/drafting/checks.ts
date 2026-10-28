/*
 * Checks on drafted bullets that don't depend on trusting the model: each
 * bullet names the resume or profile line it's based on, so code can confirm
 * that line exists and that the bullet didn't invent numbers.
 */

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

  return [...issues, ...numberIssues(bullet.text, facts)];
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
