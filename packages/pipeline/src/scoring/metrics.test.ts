import { describe, expect, it } from "vitest";
import { computeMetrics, ranks, spearman, spreadEvenly, type EvalRow } from "./metrics.ts";

describe("ranks", () => {
  it("averages ties", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
});

describe("spearman", () => {
  it("is 1 for the same ordering and -1 for the reverse", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it("is null when one side has no variation", () => {
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});

describe("computeMetrics", () => {
  const rows: EvalRow[] = [
    { label: "STRONG", verdict: "STRONG", fitScore: 90, similarity: 0.8 },
    { label: "STRONG", verdict: "POSSIBLE", fitScore: 70, similarity: 0.6 },
    { label: "POSSIBLE", verdict: "POSSIBLE", fitScore: 60, similarity: 0.7 },
    { label: "WEAK", verdict: "STRONG", fitScore: 80, similarity: 0.5 },
    { label: "WEAK", verdict: "WEAK", fitScore: 20, similarity: 0.4 },
  ];
  const m = computeMetrics(rows);

  it("counts agreement", () => {
    expect(m.n).toBe(5);
    expect(m.accuracy).toBeCloseTo(3 / 5);
    // Only WEAK -> STRONG is more than one step off.
    expect(m.withinOne).toBeCloseTo(4 / 5);
  });

  it("builds the confusion matrix by label then verdict", () => {
    expect(m.confusion.WEAK.STRONG).toBe(1);
    expect(m.confusion.STRONG.POSSIBLE).toBe(1);
  });

  it("measures precision in the top k, where k is the number of STRONG labels", () => {
    // Top 2 by score: 90 (STRONG label) and 80 (WEAK label).
    expect(m.precisionAtK).toBeCloseTo(1 / 2);
  });

  it("compares score and similarity rank correlations", () => {
    expect(m.scoreSpearman).not.toBeNull();
    expect(m.similaritySpearman).not.toBeNull();
  });
});

describe("spreadEvenly", () => {
  it("takes the first, last, and evenly spaced items between", () => {
    expect(spreadEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([0, 4, 8]);
  });

  it("returns everything when there are fewer items than requested", () => {
    expect(spreadEvenly([1, 2], 5)).toEqual([1, 2]);
  });

  it("handles a count of one", () => {
    expect(spreadEvenly([1, 2, 3], 1)).toEqual([1]);
  });
});
