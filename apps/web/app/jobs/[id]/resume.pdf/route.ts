import { parseEnv } from "@jobfox/pipeline/core/config";
import { renderResumePdf } from "@jobfox/pipeline/resume/render";
import { contactFromEnv, resumeFileName, tailorResume } from "@jobfox/pipeline/resume/tailor";
import { readResume } from "@jobfox/pipeline/scoring/context";
import { getJob, RESUME_FILE } from "@/lib/queries";

/** The tailored resume for a job, built from its latest draft. No model call. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await getJob((await params).id);
  if (!found) return new Response("Job not found.", { status: 404 });
  if (!found.draft) return new Response("Draft this job first.", { status: 404 });

  const resume = readResume(RESUME_FILE);
  const { markdown } = tailorResume({
    resume,
    bullets: found.draft.bullets,
    posting: found.job.description ?? "",
    contact: contactFromEnv(parseEnv(process.env)),
  });
  const pdf = await renderResumePdf(markdown);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: opens in the browser's viewer, which has its own download button.
      "Content-Disposition": `inline; filename="${resumeFileName(resume, found.job.company.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
