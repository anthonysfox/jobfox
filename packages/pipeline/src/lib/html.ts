const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
};

/** Decode entities in a single pass, so "&amp;lt;" becomes "&lt;" and not "<". */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Good-enough HTML to plain text for job posts: keeps paragraph breaks and
 * link targets. Not a general sanitizer; output is never rendered as HTML.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_m, href: string, label: string) =>
        /^https?:/i.test(decodeEntities(label)) ? href : `${label} (${href})`,
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?p\s*>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((m) => m[0].replace(/[.,;:]+$/, ""));
}
