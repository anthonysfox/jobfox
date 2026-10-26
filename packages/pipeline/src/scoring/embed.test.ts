import { describe, expect, it } from "vitest";
import {
  createLocalEmbedder,
  EMBEDDING_DIMENSIONS,
  jobEmbeddingText,
  resumeHash,
  toVectorLiteral,
} from "./embed.ts";

describe("jobEmbeddingText", () => {
  it("puts the title first and skips missing fields", () => {
    expect(
      jobEmbeddingText({
        title: "Full Stack Engineer",
        companyName: "Acme",
        location: null,
        description: "React and Node",
      }),
    ).toBe("Full Stack Engineer\nAcme\nReact and Node");
  });
});

describe("toVectorLiteral", () => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i / 1000);

  it("formats a vector for pgvector", () => {
    expect(toVectorLiteral(vector)).toMatch(/^\[0,0\.001,0\.002,.*\]$/);
  });

  it("rejects the wrong dimension", () => {
    expect(() => toVectorLiteral([1, 2, 3])).toThrow(/384 dimensions/);
  });

  it("rejects non-finite values", () => {
    expect(() => toVectorLiteral([...vector.slice(1), Number.NaN])).toThrow(/non-finite/);
  });
});

describe("resumeHash", () => {
  it("is stable and changes with the text", () => {
    expect(resumeHash("a")).toBe(resumeHash("a"));
    expect(resumeHash("a")).not.toBe(resumeHash("b"));
  });
});

// Loads the real model (~35 MB, downloaded once). Run with EMBEDDING_TESTS=1.
describe.skipIf(!process.env.EMBEDDING_TESTS)("createLocalEmbedder", () => {
  it("ranks a related job above an unrelated one", async () => {
    const embedder = await createLocalEmbedder();
    const resume = await embedder.embedQuery("Full-stack engineer: TypeScript, React, Node.js");
    const [related, unrelated] = await embedder.embedDocuments([
      "Frontend Engineer building React and TypeScript dashboards",
      "Registered nurse for the night shift in the ICU",
    ]);
    const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);

    expect(resume).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(dot(resume, related ?? [])).toBeGreaterThan(dot(resume, unrelated ?? []));
  }, 120_000);
});
