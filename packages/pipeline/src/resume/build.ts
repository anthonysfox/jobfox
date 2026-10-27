import { renderResumePdf, type RenderedResume } from "./render.ts";
import { tailorResume, type TailoredResume, type TailorOptions } from "./tailor.ts";

/**
 * The tailored resume with as many new bullets as fit on one page, most
 * relevant first. The model ranks the bullets; code decides how many fit, by
 * rendering and counting pages. Rendering takes milliseconds, so trying each
 * count is cheaper than estimating text height.
 */
export async function buildTailoredResume(
  options: Omit<TailorOptions, "maxAdditions">,
): Promise<RenderedResume & TailoredResume> {
  const available = options.bullets.filter(
    (b) => b.entry !== undefined && b.issues.length === 0,
  ).length;
  for (let count = available; count > 0; count--) {
    const tailored = tailorResume({ ...options, maxAdditions: count });
    const rendered = await renderResumePdf(tailored.markdown);
    if (rendered.pages === 1) return { ...tailored, ...rendered };
  }
  // No new bullets fit (or none exist); a resume longer than a page stays as it is.
  const tailored = tailorResume({ ...options, maxAdditions: 0 });
  return { ...tailored, ...(await renderResumePdf(tailored.markdown)) };
}
