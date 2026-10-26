import { createHash } from "node:crypto";

/*
 * Local embeddings with bge-small-en-v1.5 via transformers.js: no API key, no
 * cost, and small enough to bundle into a Lambda later. The model reads at
 * most 512 tokens, so the job title goes first and long descriptions are cut
 * off by the tokenizer.
 */

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBEDDING_DIMENSIONS = 384;

// bge models expect this prefix on the query side (the resume), not on documents (jobs).
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
const BATCH_SIZE = 32;

export interface Embedder {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export async function createLocalEmbedder(): Promise<Embedder> {
  const { pipeline } = await import("@huggingface/transformers");
  const extract = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });

  async function run(texts: string[]): Promise<number[][]> {
    const output = await extract(texts, { pooling: "cls", normalize: true });
    return output.tolist() as number[][];
  }

  return {
    async embedQuery(text) {
      const [vector] = await run([QUERY_PREFIX + text]);
      if (!vector) throw new Error("Embedding model returned no vector");
      return vector;
    },
    async embedDocuments(texts) {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        vectors.push(...(await run(texts.slice(i, i + BATCH_SIZE))));
      }
      return vectors;
    },
  };
}

export function jobEmbeddingText(job: {
  title: string;
  companyName: string;
  location: string | null;
  description: string | null;
}): string {
  return [job.title, job.companyName, job.location, job.description].filter(Boolean).join("\n");
}

/** pgvector's text format. Validates first, since the result is cast with ::vector in SQL. */
export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  }
  if (!vector.every(Number.isFinite)) throw new Error("Embedding contains a non-finite value");
  return `[${vector.join(",")}]`;
}

export function resumeHash(resume: string): string {
  return createHash("sha256").update(resume).digest("hex");
}
