import Link from "next/link";
import { JobCard } from "@/components/JobCard";
import { listJobs, parseFilters, TABS, type JobFilters, type Tab } from "@/lib/queries";

const TAB_LABELS: Record<Tab, string> = {
  strong: "Strong",
  possible: "Possible",
  weak: "Weak",
  unscored: "Unscored",
  saved: "Saved",
  applied: "Applied",
};

const MAX_SHOWN = 200;

function href(tab: Tab, filters: JobFilters): string {
  const params = new URLSearchParams({ tab });
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.minScore > 0) params.set("min", String(filters.minScore));
  return `/jobs?${params.toString()}`;
}

const selectClass =
  "rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab, filters } = parseFilters(await searchParams);
  const { rows, counts } = await listJobs(tab, filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-stone-200 dark:border-stone-800">
        {TABS.map((t) => (
          <Link
            key={t}
            href={href(t, filters)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t === tab
                ? "border-stone-900 font-medium dark:border-stone-100"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            {TAB_LABELS[t]} <span className="tabular-nums text-stone-400">{counts[t]}</span>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-3 text-sm" action="/jobs">
        <input type="hidden" name="tab" value={tab} />
        <label className="flex items-center gap-1.5">
          Where
          <select name="area" defaultValue={filters.area} className={selectClass}>
            <option value="all">Anywhere</option>
            <option value="local">NYC / NJ</option>
            <option value="remote">Remote</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Description
          <select name="source" defaultValue={filters.source} className={selectClass}>
            <option value="all">Any source</option>
            <option value="ats">Full ATS posting</option>
            <option value="hn">Hacker News</option>
            <option value="adzuna">Adzuna snippet</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Min score
          <input
            type="number"
            name="min"
            min={0}
            max={100}
            step={5}
            defaultValue={filters.minScore || ""}
            className={`${selectClass} w-20`}
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-stone-300 px-3 py-1 dark:border-stone-700"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-stone-500">
          {tab === "unscored" ? "Everything is scored." : "No jobs here with these filters."}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, MAX_SHOWN).map((row) => (
            <JobCard key={row.job.id} row={row} />
          ))}
          {rows.length > MAX_SHOWN && (
            <p className="text-center text-sm text-stone-500">
              Showing the top {MAX_SHOWN} of {rows.length}. Narrow the filters to see the rest.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
