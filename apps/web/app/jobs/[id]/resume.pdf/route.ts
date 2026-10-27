import { parseEnv } from "@jobfox/pipeline/core/config";
import { buildTailoredResume } from "@jobfox/pipeline/resume/build";
import { contactFromEnv, resumeFileName } from "@jobfox/pipeline/resume/tailor";
import { readResume } from "@jobfox/pipeline/scoring/context";
import { getJob, RESUME_FILE } from "@/lib/queries";

/** The tailored resume for a job, built from its latest draft. No model call. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await getJob((await params).id);
  if (!found) return new Response("Job not found.", { status: 404 });
  if (!found.draft) return new Response("Draft this job first.", { status: 404 });

  const resume = readResume(RESUME_FILE);
  const { pdf } = await buildTailoredResume({
    resume,
    bullets: found.draft.bullets,
    posting: found.job.description ?? "",
    contact: contactFromEnv(parseEnv(process.env)),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // attachment: some viewers save an inline PDF as "resume.pdf", ignoring the name.
      "Content-Disposition": `attachment; filename="${resumeFileName(resume, found.job.title, found.job.company.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
