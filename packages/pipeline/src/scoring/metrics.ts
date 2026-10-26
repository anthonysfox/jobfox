import type { Verdict } from "./scorer.ts";

export const VERDICTS: Verdict[] = ["STRONG", "POSSIBLE", "WEAK"];
const ORDINAL: Record<Verdict, number> = { STRONG: 2, POSSIBLE: 1, WEAK: 0 };

/** Ranks starting at 1, with tied values sharing their average rank. */
export function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]?.value === order[i]?.value) j++;
    const average = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k]?.index ?? 0] = average;
    i = j + 1;
  }
  return result;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = (xs[i] ?? 0) - mx;
    const b = (ys[i] ?? 0) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/** Spearman rank correlation: 1 means the same ordering, 0 none, -1 reversed. */
export function spearman(xs: number[], ys: number[]): number | null {
  return pearson(ranks(xs), ranks(ys));
}

export interface EvalRow {
  label: Verdict;
  verdict: Verdict;
  fitScore: number;
  similarity: number;
}

export interface EvalMetrics {
  n: number;
  accuracy: number;
  withinOne: number;
  /** confusion[label][verdict] = count */
  confusion: Record<Verdict, Record<Verdict, number>>;
  scoreSpearman: number | null;
  similaritySpearman: number | null;
  /** Of the k highest-scored jobs (k = number labeled STRONG), the share I'd apply to (STRONG or POSSIBLE). */
  precisionAtK: number | null;
}

export function computeMetrics(rows: EvalRow[]): EvalMetrics {
  const confusion = Object.fromEntries(
    VERDICTS.map((l) => [l, Object.fromEntries(VERDICTS.map((v) => [v, 0]))]),
  ) as EvalMetrics["confusion"];
  for (const row of rows) confusion[row.label][row.verdict]++;

  const labels = rows.map((r) => ORDINAL[r.label]);
  const k = rows.filter((r) => r.label === "STRONG").length;
  const topK = [...rows].sort((a, b) => b.fitScore - a.fitScore).slice(0, k);

  return {
    n: rows.length,
    accuracy: rows.filter((r) => r.label === r.verdict).length / Math.max(1, rows.length),
    withinOne:
      rows.filter((r) => Math.abs(ORDINAL[r.label] - ORDINAL[r.verdict]) <= 1).length /
      Math.max(1, rows.length),
    confusion,
    scoreSpearman: spearman(
      rows.map((r) => r.fitScore),
      labels,
    ),
    similaritySpearman: spearman(
      rows.map((r) => r.similarity),
      labels,
    ),
    precisionAtK: k > 0 ? topK.filter((r) => r.label !== "WEAK").length / k : null,
  };
}

/** `count` items spread evenly from the top of a ranked list to the bottom. */
export function spreadEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  if (count <= 1) return items.slice(0, count);
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)]).filter(
    (item): item is T => item !== undefined,
  );
}
