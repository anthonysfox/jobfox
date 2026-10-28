import { renderResumePdf, type RenderedResume } from "./render.ts";
import { tailorResume, type TailoredResume, type TailorOptions } from "./tailor.ts";

/**
 * The tailored resume with as many new bullets as fit on one page, most
 * relevant first. The model ranks the bullets; code decides how many fit, by
 * rendering and counting pages. Rendering takes milliseconds, so trying each
 * count is cheaper than estimating text height.
 *
 * The tailored summary comes before new bullets: it's what a reader sees
 * first. If even the summary alone pushes the page over, the original stays.
 */
export async function buildTailoredResume(
  options: Omit<TailorOptions, "maxAdditions">,
): Promise<RenderedResume & TailoredResume> {
  const available = options.bullets.filter(
    (b) => b.entry !== undefined && b.issues.length === 0,
  ).length;
  const summaries = options.summary ? [options.summary, null] : [null];
  for (const summary of summaries) {
    for (let count = available; count >= 0; count--) {
      const tailored = tailorResume({ ...options, summary, maxAdditions: count });
      const rendered = await renderResumePdf(tailored.markdown);
      if (rendered.pages === 1) return { ...tailored, ...rendered };
    }
  }
  // A resume longer than a page even untailored stays as it is.
  const tailored = tailorResume({ ...options, summary: null, maxAdditions: 0 });
  return { ...tailored, ...(await renderResumePdf(tailored.markdown)) };
}
