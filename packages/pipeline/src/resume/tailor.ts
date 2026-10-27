import { comparable } from "../drafting/checks.ts";
import type { DraftBullet } from "../drafting/drafter.ts";
import { containsPhrase } from "../lib/normalize.ts";

/*
 * Builds a tailored copy of my resume Markdown from a draft, with plain string
 * edits: no model call, and nothing changes except what's described here.
 *
 * - Each drafted bullet replaces the resume line it names as its source.
 *   Bullets the checks flagged are skipped, so that line stays as I wrote it.
 * - Within each list, replaced bullets move to the top in the draft's order
 *   (most relevant first); the rest keep their original order.
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
}

export interface TailoredResume {
  markdown: string;
  /** How many drafted bullets were used. */
  replaced: number;
}

const LIST_ITEM = /^(\s*[-*]\s+)(.*)$/;
const SKILL_LINE = /^(\s*[-*]\s+\*\*[^*]+\*\*\s*)(.+)$/;

interface Line {
  text: string;
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
}: TailorOptions): TailoredResume {
  const usable = bullets
    .map((bullet, rank) => ({ bullet, rank, source: comparable(bullet.source) }))
    .filter((b) => b.bullet.issues.length === 0 && b.source.length > 0);
  const used = new Set<number>();
  let section = "";
  let afterName = false;

  const lines: Line[] = resume.split("\n").map((text) => {
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

    if (section.includes("skill")) {
      const skill = SKILL_LINE.exec(text);
      return skill
        ? { text: `${skill[1] ?? ""}${orderSkills(skill[2] ?? "", posting)}` }
        : { text };
    }

    const key = comparable(content);
    // The source may quote part of a line; require it to cover most of the line.
    const match = usable.find(
      (b) => !used.has(b.rank) && key.includes(b.source) && b.source.length >= key.length / 2,
    );
    if (!match) return { text };
    used.add(match.rank);
    return { text: `${marker}${match.bullet.text}`, rank: match.rank };
  });

  // Reorder each run of consecutive list items: replaced first, by rank; stable otherwise.
  const out: string[] = [];
  let run: Line[] = [];
  const flush = () => {
    const replaced = run
      .filter((l) => l.rank !== undefined)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    out.push(...[...replaced, ...run.filter((l) => l.rank === undefined)].map((l) => l.text));
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

  return { markdown: out.join("\n"), replaced: used.size };
}

export function contactFromEnv(env: {
  RESUME_EMAIL?: string | undefined;
  RESUME_PHONE?: string | undefined;
}): string[] {
  return [env.RESUME_EMAIL, env.RESUME_PHONE].filter((v): v is string => v !== undefined);
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
