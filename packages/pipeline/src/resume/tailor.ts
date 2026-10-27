import { comparable } from "../drafting/checks.ts";
import type { DraftBullet } from "../drafting/drafter.ts";
import { containsPhrase } from "../lib/normalize.ts";
import { LIST_ITEM, listEntries } from "./entries.ts";

/*
 * Builds a tailored copy of my resume Markdown from a draft, with plain string
 * edits: no model call, and nothing changes except what's described here.
 *
 * - Each drafted bullet replaces the resume line it names as its source.
 *   Bullets the checks flagged are skipped, so that line stays as I wrote it.
 * - Within each list, replaced bullets move to the top in the draft's order
 *   (most relevant first), then any new bullets for that entry, then the
 *   untouched lines in their original order. New bullets are used in the
 *   draft's order up to maxAdditions, so the caller can fit the page.
 * - In the skills section, skills the posting mentions move to the front of their line.
 * - Contact details, which stay out of the resume file the model sees, are
 *   added to the line under my name.
 */

export interface TailorOptions {
  resume: string;
  bullets: DraftBullet[];
  /** The posting text, for ordering skills. */
  posting: string;
  /** Extra contact details, e.g. email and phone. */
  contact?: string[];
  /** How many new bullets to use, most relevant first. Defaults to all. */
  maxAdditions?: number;
}

export interface TailoredResume {
  markdown: string;
  /** How many rewritten bullets were used. */
  replaced: number;
  /** How many new bullets were added. */
  added: number;
}

const SKILL_LINE = /^(\s*[-*]\s+\*\*[^*]+\*\*\s*)(.+)$/;

interface Line {
  text: string;
  /** The entry this list item belongs to, if any. */
  entry?: string | undefined;
  /** Position of the drafted bullet that replaced this line, if any. */
  rank?: number;
}

function orderSkills(items: string, posting: string): string {
  const skills = items.split(/,\s*/);
  // Match on the name without parentheticals: "AWS (Certified …)" matches "AWS".
  const mentioned = (skill: string) =>
    containsPhrase(posting, skill.replace(/\([^)]*\)/g, " ").trim());
  return [...skills.filter(mentioned), ...skills.filter((s) => !mentioned(s))].join(", ");
}

export function tailorResume({
  resume,
  bullets,
  posting,
  contact = [],
  maxAdditions = Infinity,
}: TailorOptions): TailoredResume {
  const usable = bullets
    .map((bullet, rank) => ({ bullet, rank, source: comparable(bullet.source) }))
    .filter((b) => b.bullet.issues.length === 0 && b.source.length > 0);
  const rewrites = usable.filter((b) => b.bullet.entry === undefined);
  let additions = usable
    .filter((b) => b.bullet.entry !== undefined)
    .slice(0, maxAdditions)
    .map(({ bullet }) => ({ text: bullet.text, entry: comparable(bullet.entry ?? "") }));
  const used = new Set<number>();
  let section = "";
  let afterName = false;

  const resumeLines = resume.split("\n");
  const entryOf = listEntries(resumeLines);
  const lines: Line[] = resumeLines.map((text, index) => {
    if (text.startsWith("# ")) {
      afterName = true;
      return { text };
    }
    if (afterName && text.trim() !== "") {
      afterName = false;
      if (!text.startsWith("#") && contact.length > 0) {
        return { text: [text.trim(), ...contact].join(" · ") };
      }
    }
    if (text.startsWith("## ")) section = text.toLowerCase();

    const item = LIST_ITEM.exec(text);
    if (!item) return { text };
    const [, marker = "", content = ""] = item;
    const entry = entryOf[index];

    if (section.includes("skill")) {
      const skill = SKILL_LINE.exec(text);
      return skill
        ? { text: `${skill[1] ?? ""}${orderSkills(skill[2] ?? "", posting)}` }
        : { text };
    }

    const key = comparable(content);
    // The source may quote part of a line; require it to cover most of the line.
    const match = rewrites.find(
      (b) => !used.has(b.rank) && key.includes(b.source) && b.source.length >= key.length / 2,
    );
    if (!match) return { text, entry };
    used.add(match.rank);
    return { text: `${marker}${match.bullet.text}`, rank: match.rank, entry };
  });

  // Reorder each run of consecutive list items: replaced first by rank, then
  // new bullets for the entry, then the rest in their original order.
  const out: string[] = [];
  let run: Line[] = [];
  let added = 0;
  const flush = () => {
    const first = run[0];
    if (!first) return;
    const marker = LIST_ITEM.exec(first.text)?.[1] ?? "- ";
    const replaced = run
      .filter((l) => l.rank !== undefined)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const entry = first.entry === undefined ? undefined : comparable(first.entry);
    const extra = additions.filter((a) => entry !== undefined && a.entry === entry);
    additions = additions.filter((a) => !extra.includes(a));
    added += extra.length;
    out.push(
      ...replaced.map((l) => l.text),
      ...extra.map((a) => `${marker}${a.text}`),
      ...run.filter((l) => l.rank === undefined).map((l) => l.text),
    );
    run = [];
  };
  for (const line of lines) {
    if (LIST_ITEM.test(line.text)) {
      run.push(line);
    } else {
      flush();
      out.push(line.text);
    }
  }
  flush();

  return { markdown: out.join("\n"), replaced: used.size, added };
}

export function contactFromEnv(env: {
  RESUME_EMAIL?: string | undefined;
  RESUME_PHONE?: string | undefined;
  RESUME_LINKS?: string | undefined;
}): string[] {
  const links = (env.RESUME_LINKS ?? "")
    .split(",")
    .map((link) => link.trim())
    .filter(Boolean);
  return [...links, env.RESUME_EMAIL, env.RESUME_PHONE].filter((v): v is string => !!v);
}

/** "Anthony_Fox_Resume_Acme.pdf", from the resume's heading and the company. */
export function resumeFileName(resume: string, company: string): string {
  const name = /^# (.+)$/m.exec(resume)?.[1] ?? "Resume";
  const part = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return `${part(name)}_Resume_${part(company)}.pdf`;
}
