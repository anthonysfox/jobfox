import { renderResumePdf, type RenderedResume } from "./render.ts";
import { tailorResume, type TailoredResume, type TailorOptions } from "./tailor.ts";

/** How far the gaps between sections, entries, and bullets may grow to fill the page. */
export const MAX_SPACING = 2;
/** How far they may shrink to keep the page to one, when the content is a little over. */
export const MIN_SPACING = 0.8;
const SPACING_STEP = 0.05;

type Built = RenderedResume & TailoredResume & { spacing: number };

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
 *
 * Only when nothing fits at normal spacing do the gaps shrink, down to
 * MIN_SPACING, so a resume slightly over a page stays on one.
 */
export async function buildTailoredResume(
  options: Omit<TailorOptions, "maxAdditions">,
): Promise<Built> {
  const available = options.bullets.filter(
    (b) => b.entry !== undefined && b.issues.length === 0,
  ).length;
  const summaries = options.summary ? [options.summary, null] : [null];
  for (const minSpacing of [1, MIN_SPACING]) {
    for (const summary of summaries) {
      for (let count = available; count >= 0; count--) {
        const tailored = tailorResume({ ...options, summary, maxAdditions: count });
        const built = await fitPage(tailored, minSpacing);
        if (built) return built;
      }
    }
  }
  // A resume longer than a page even at the tightest spacing stays as it is.
  const tailored = tailorResume({ ...options, summary: null, maxAdditions: 0 });
  return { ...tailored, ...(await renderResumePdf(tailored.markdown)), spacing: 1 };
}

/** The largest spacing from MAX_SPACING down to minSpacing that keeps one page, or null. */
async function fitPage(tailored: TailoredResume, minSpacing: number): Promise<Built | null> {
  // Tighter spacing never adds pages, so if the smallest doesn't fit, nothing will.
  const tightest = await renderResumePdf(tailored.markdown, { spacing: minSpacing });
  if (tightest.pages !== 1) return null;

  const steps = Math.round((MAX_SPACING - minSpacing) / SPACING_STEP);
  // Largest first: the first spacing that still fits on one page wins.
  for (let i = steps; i > 0; i--) {
    const spacing = minSpacing + i * SPACING_STEP;
    const rendered = await renderResumePdf(tailored.markdown, { spacing });
    if (rendered.pages === 1) return { ...tailored, ...rendered, spacing };
  }
  return { ...tailored, ...tightest, spacing: minSpacing };
}
