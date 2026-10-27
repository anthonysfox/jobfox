import type { DraftBullet } from "@jobfox/pipeline/drafting/drafter";
import { CopyButton } from "./CopyButton";
import { DraftForm } from "./DraftForm";

interface Draft {
  bullets: DraftBullet[];
  questions: string[];
  answers: string[];
  model: string;
  costUsd: number | null;
  createdAt: Date;
}

const heading = "text-sm font-semibold uppercase tracking-wide text-stone-500";

/** Tailored bullets and answers to copy into my resume and the real form. Nothing is submitted. */
export function DraftPanel({
  jobId,
  draft,
  defaultQuestions,
}: {
  jobId: string;
  draft: Draft | undefined;
  defaultQuestions: string[];
}) {
  return (
    <section className="space-y-5 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <h2 className="font-semibold">Application draft</h2>
      <DraftForm
        jobId={jobId}
        questions={draft?.questions ?? defaultQuestions}
        hasDraft={draft !== undefined}
      />

      {draft && (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={heading}>Resume bullets</h3>
              <CopyButton
                text={draft.bullets.map((b) => `- ${b.text}`).join("\n")}
                label="Copy all"
              />
            </div>
            <ul className="space-y-3">
              {draft.bullets.map((bullet) => (
                <li key={bullet.text} className="flex gap-3">
                  <div className="flex-1 text-sm">
                    <p>{bullet.text}</p>
                    <details className="mt-1 text-xs text-stone-500">
                      <summary className="cursor-pointer">Original</summary>
                      <p className="mt-1">{bullet.source}</p>
                    </details>
                    {bullet.issues.map((issue) => (
                      <p key={issue} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        Check this: {issue}
                      </p>
                    ))}
                  </div>
                  <CopyButton text={bullet.text} />
                </li>
              ))}
            </ul>
          </div>

          {draft.questions.length > 0 && (
            <div className="space-y-4">
              <h3 className={heading}>Answers</h3>
              {draft.questions.map((question, i) => {
                const answer = draft.answers[i] ?? "";
                return (
                  <div key={question}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{question}</p>
                      {answer && <CopyButton text={answer} />}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {answer || <span className="text-stone-500">No answer drafted.</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
            <a
              href={`/jobs/${jobId}/resume.pdf`}
              target="_blank"
              rel="noopener"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
            >
              Tailored resume (PDF) ↗
            </a>
            <span className="text-xs text-stone-500">
              Your resume with these bullets swapped in and matching skills listed first. Flagged
              bullets are left as you wrote them.
            </span>
          </div>

          <p className="text-xs text-stone-500">
            {draft.model} · {draft.createdAt.toLocaleString("en-US")}
            {draft.costUsd !== null && ` · ~$${draft.costUsd.toFixed(3)}`} · Review and edit before
            you use any of it.
          </p>
        </>
      )}
    </section>
  );
}
