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

/** Numbers as written, e.g. "40%", "$1.2M", "3", with thousands separators dropped. */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replaceAll(",", ""));
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

  // Compare against all the facts, so a number moved in from another line is fine.
  const known = new Set(numbersIn(`${facts.resume}\n${facts.profile}`));
  const invented = [...new Set(numbersIn(bullet.text))].filter((n) => !known.has(n));
  if (invented.length > 0) {
    issues.push(`Numbers not in your resume or profile: ${invented.join(", ")}.`);
  }
  return issues;
}
