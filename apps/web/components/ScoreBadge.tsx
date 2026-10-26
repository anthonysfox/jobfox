const STYLES = {
  STRONG: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  POSSIBLE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  WEAK: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
} as const;

export function ScoreBadge({
  score,
}: {
  score: { fitScore: number; verdict: keyof typeof STYLES } | undefined;
}) {
  if (!score) {
    return (
      <span className="rounded-md border border-dashed border-stone-300 px-2 py-1 text-xs text-stone-500 dark:border-stone-700">
        unscored
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-w-11 justify-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${STYLES[score.verdict]}`}
      title={`${score.verdict.toLowerCase()} fit`}
    >
      {score.fitScore}
    </span>
  );
}
