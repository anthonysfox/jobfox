import type { EvalMetrics } from "@jobfox/pipeline/scoring/metrics";
import { listEvalRuns } from "@/lib/queries";

// Reads the database on every request; without this Next would prerender it at build time.
export const dynamic = "force-dynamic";

const VERDICTS = ["STRONG", "POSSIBLE", "WEAK"] as const;

interface StoredRow {
  jobId: string;
  title: string;
  company: string;
  summary: string;
  note: string | null;
  label: string;
  verdict: string;
  fitScore: number;
}

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);
const corr = (v: number | null) => (v === null ? "n/a" : v.toFixed(2));

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

export default async function EvalPage() {
  const runs = await listEvalRuns();
  const latest = runs[0];

  if (!latest) {
    return (
      <div className="space-y-2 py-12 text-center">
        <p className="text-lg font-medium">No eval runs yet.</p>
        <p className="text-stone-500">Label at least 10 jobs, then run pnpm eval.</p>
      </div>
    );
  }

  // Written by pnpm eval in this repo, so the shapes are known.
  const metrics = latest.metrics as unknown as EvalMetrics;
  const rows = latest.rows as unknown as StoredRow[];
  const misses = rows.filter((r) => r.label !== r.verdict);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Scorer eval</h1>
        <p className="text-sm text-stone-500">
          {latest.model} · effort {latest.effort} · {metrics.n} labeled jobs ·{" "}
          {latest.createdAt.toLocaleString("en-US")}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Agreement"
          value={pct(metrics.accuracy)}
          hint={`${pct(metrics.withinOne)} within one step`}
        />
        <Stat
          label="Precision@k"
          value={pct(metrics.precisionAtK)}
          hint="of top-scored jobs are ones I'd apply to"
        />
        <Stat
          label="Score rank corr."
          value={corr(metrics.scoreSpearman)}
          hint="Spearman vs. my labels"
        />
        <Stat
          label="Embeddings only"
          value={corr(metrics.similaritySpearman)}
          hint="baseline the model should beat"
        />
      </div>

      <section>
        <h2 className="mb-2 font-medium">Confusion matrix</h2>
        <table className="text-sm tabular-nums">
          <thead>
            <tr className="text-stone-500">
              <th className="px-3 py-1 text-left font-normal">My label ↓ / scorer →</th>
              {VERDICTS.map((v) => (
                <th key={v} className="px-3 py-1 font-normal">
                  {v.toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VERDICTS.map((label) => (
              <tr key={label} className="border-t border-stone-200 dark:border-stone-800">
                <td className="px-3 py-1.5">{label.toLowerCase()}</td>
                {VERDICTS.map((v) => (
                  <td
                    key={v}
                    className={`px-3 py-1.5 text-center ${label === v ? "font-semibold" : "text-stone-500"}`}
                  >
                    {metrics.confusion[label][v]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {misses.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Disagreements ({misses.length})</h2>
          <ul className="space-y-3">
            {misses.map((r) => (
              <li key={r.jobId} className="text-sm">
                <a href={`/jobs/${r.jobId}`} className="font-medium hover:underline">
                  {r.company} — {r.title}
                </a>
                <p className="text-stone-600 dark:text-stone-400">
                  You: {r.label.toLowerCase()} · scorer: {r.fitScore} ({r.verdict.toLowerCase()})
                </p>
                <p>{r.summary}</p>
                {r.note && <p className="text-stone-500">Your note: {r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {runs.length > 1 && (
        <section>
          <h2 className="mb-2 font-medium">Earlier runs</h2>
          <ul className="space-y-1 text-sm text-stone-600 dark:text-stone-400">
            {runs.slice(1).map((run) => {
              const m = run.metrics as unknown as EvalMetrics;
              return (
                <li key={run.id}>
                  {run.createdAt.toLocaleDateString("en-US")} · {run.model} · agreement{" "}
                  {pct(m.accuracy)} · rank corr. {corr(m.scoreSpearman)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
