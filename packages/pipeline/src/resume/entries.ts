/*
 * A resume "entry" is the line that heads a list of bullets: a "###" project,
 * a bold role line such as "**Software Engineer**, 2025", or a "##" section
 * when the list sits right under it. New bullets name the entry they go under.
 */

export const LIST_ITEM = /^(\s*[-*]\s+)(.*)$/;

/** The entry text without Markdown: "Software Engineer, January 2025 – July 2025". */
export function entryLabel(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

/**
 * For each line, the entry its list belongs to (undefined outside lists).
 * Skills lists get no entry: they're reordered, never added to.
 */
export function listEntries(lines: string[]): (string | undefined)[] {
  let section = "";
  let heading: string | undefined;
  return lines.map((line) => {
    if (line.startsWith("## ")) section = line.toLowerCase();
    if (LIST_ITEM.test(line)) return section.includes("skill") ? undefined : heading;
    if (line.trim() !== "") heading = line.startsWith("# ") ? undefined : entryLabel(line);
    return undefined;
  });
}

/** The distinct entries in a resume, in order. */
export function resumeEntries(resume: string): string[] {
  const entries = listEntries(resume.split("\n")).filter((e): e is string => e !== undefined);
  return [...new Set(entries)];
}
