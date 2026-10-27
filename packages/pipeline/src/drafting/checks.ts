/*
 * Checks on drafted bullets that don't depend on trusting the model: each
 * bullet names the resume line it rewrites, so code can confirm that line
 * exists and that the rewrite didn't invent numbers.
 */

/** Lowercase words and numbers only, so Markdown, punctuation, and spacing don't matter. */
function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Numbers as written, e.g. "40%", "$1.2M", "3", with thousands separators dropped. */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replaceAll(",", ""));
}

export function bulletIssues(bullet: { text: string; source: string }, resume: string): string[] {
  const issues: string[] = [];
  const source = comparable(bullet.source);
  if (source.length === 0 || !comparable(resume).includes(source)) {
    issues.push("The source line isn't in your resume.");
  }
  // Compare against the whole resume, so a number moved in from another line is fine.
  const known = new Set(numbersIn(resume));
  const invented = [...new Set(numbersIn(bullet.text))].filter((n) => !known.has(n));
  if (invented.length > 0) {
    issues.push(`Numbers not in your resume: ${invented.join(", ")}.`);
  }
  return issues;
}
