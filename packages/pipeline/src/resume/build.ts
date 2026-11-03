import { renderResumePdf, type RenderedResume } from "./render.ts";
import { tailorResume, type TailoredResume, type TailorOptions } from "./tailor.ts";

/** How far the gaps between sections, entries, and bullets may grow to fill the page. */
export const MAX_SPACING = 2;
const SPACING_STEP = 0.05;

/**
 * The tailored resume with as many new bullets as fit on one page, most
 * relevant first. The model ranks the bullets; code decides how many fit, by
 * rendering and counting pages. Rendering takes milliseconds, so trying each
 * count is cheaper than estimating text height.
 *
 * The tailored summary comes before new bullets: it's what a reader sees
 * first. If even the summary alone pushes the page over, the original stays.
 *
 * Once the content is settled, the gaps between sections and bullets grow
 * until the page is full, so a resume with room to spare doesn't end two
 * inches early. Spacing, not type size: larger type rewraps lines, and even
 * 4% left single words ("Linux") on their own lines.
 */
export async function buildTailoredResume(
  options: Omit<TailorOptions, "maxAdditions">,
): Promise<RenderedResume & TailoredResume & { spacing: number }> {
  const available = options.bullets.filter(
    (b) => b.entry !== undefined && b.issues.length === 0,
  ).length;
  const summaries = options.summary ? [options.summary, null] : [null];
  for (const summary of summaries) {
    for (let count = available; count >= 0; count--) {
      const tailored = tailorResume({ ...options, summary, maxAdditions: count });
      const rendered = await renderResumePdf(tailored.markdown);
      if (rendered.pages === 1) return fillPage(tailored, rendered);
    }
  }
  // A resume longer than a page even untailored stays as it is.
  const tailored = tailorResume({ ...options, summary: null, maxAdditions: 0 });
  return { ...tailored, ...(await renderResumePdf(tailored.markdown)), spacing: 1 };
}

async function fillPage(
  tailored: TailoredResume,
  fits: RenderedResume,
): Promise<RenderedResume & TailoredResume & { spacing: number }> {
  // Largest first: the first spacing that still fits on one page wins.
  for (let i = Math.round((MAX_SPACING - 1) / SPACING_STEP); i > 0; i--) {
    const spacing = 1 + i * SPACING_STEP;
    const rendered = await renderResumePdf(tailored.markdown, { spacing });
    if (rendered.pages === 1) return { ...tailored, ...rendered, spacing };
  }
  return { ...tailored, ...fits, spacing: 1 };
}
