import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftPanel } from "@/components/DraftPanel";
import { ScoreBadge } from "@/components/ScoreBadge";
import { StatusButtons } from "@/components/StatusButtons";
import { config, getJob } from "@/lib/queries";

const SOURCE_NAMES: Record<string, string> = {
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  ASHBY: "Ashby",
  HN_HIRING: "Hacker News",
  ADZUNA: "Adzuna",
};

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await getJob((await params).id);
  if (!found) notFound();
  const { job, score, draft } = found;

  const salary =
    job.salaryMin !== null || job.salaryMax !== null
      ? [job.salaryMin, job.salaryMax]
          .filter((n): n is number => n !== null)
          .map((n) => n.toLocaleString("en-US"))
          .join(" – ") + ` ${job.salaryCurrency ?? ""}`
      : null;
  const sources = [...new Set(job.postings.map((p) => SOURCE_NAMES[p.source] ?? p.source))];

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-stone-500 hover:underline">
        ← All jobs
      </Link>

      <header className="flex items-start gap-4">
        <ScoreBadge score={score} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <p className="text-stone-600 dark:text-stone-400">
            {[
              job.company.name,
              job.location,
              job.workplaceType !== "UNKNOWN" ? job.workplaceType.toLowerCase() : null,
              salary,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Seen on {sources.join(", ")} · first seen {job.firstSeenAt.toLocaleDateString("en-US")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900"
            >
              Open posting ↗
            </a>
            <StatusButtons jobId={job.id} current={job.status} />
          </div>
        </div>
      </header>

      <DraftPanel
        jobId={job.id}
        draft={draft}
        defaultQuestions={config.drafting.defaultQuestions}
      />

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <section className="order-2 md:order-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Description
          </h2>
          {job.descriptionSource === "ADZUNA" && (
            <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
              Adzuna only provides a snippet; open the posting for the full description.
            </p>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {job.description ?? "No description."}
          </div>
        </section>

        <aside className="order-1 space-y-4 md:order-2">
          {score ? (
            <>
              <p className="text-sm">{score.summary}</p>
              <div>
                <h2 className="mb-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Strengths
                </h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {score.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              {score.gaps.length > 0 && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Gaps
                  </h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {score.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-stone-500">
                {score.model} · similarity {score.similarity.toFixed(2)} ·{" "}
                {score.createdAt.toLocaleDateString("en-US")}
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-500">Not scored yet. Run pnpm score.</p>
          )}
          {job.label && (
            <p className="text-sm">
              Your label: <span className="font-medium">{job.label.label.toLowerCase()}</span>
              {job.label.note && <span className="text-stone-500"> · {job.label.note}</span>}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
