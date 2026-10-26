import Link from "next/link";
import type { JobRow } from "@/lib/queries";
import { ScoreBadge } from "./ScoreBadge";
import { StatusButtons } from "./StatusButtons";

export function JobCard({ row }: { row: JobRow }) {
  const { job, score } = row;
  const where = [
    job.location,
    job.workplaceType !== "UNKNOWN" ? job.workplaceType.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-3">
        <ScoreBadge score={score} />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">
            <Link href={`/jobs/${job.id}`} className="hover:underline">
              {job.title}
            </Link>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {job.company.name}
            {where && ` · ${where}`}
          </p>
          {score && <p className="mt-2 text-sm">{score.summary}</p>}
          {score && score.gaps.length > 0 && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              <span className="font-medium">Gaps:</span> {score.gaps.slice(0, 2).join("; ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
            >
              Open posting ↗
            </a>
            <StatusButtons jobId={job.id} current={job.status} />
            {job.descriptionSource === "ADZUNA" && (
              <span className="text-xs text-stone-500">Jobs by Adzuna</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
