import type { PrismaClient } from "../lib/db.js";
import { toVectorLiteral } from "./embed.js";

// Prisma can't read or write Unsupported("vector") columns, so these use raw
// SQL. Every value goes through a tagged template, which Prisma parameterizes.

export async function jobsMissingEmbeddings(db: PrismaClient, jobIds: string[]): Promise<string[]> {
  if (jobIds.length === 0) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Job" WHERE id = ANY(${jobIds}) AND embedding IS NULL`;
  return rows.map((r) => r.id);
}

export async function saveEmbedding(db: PrismaClient, jobId: string, vector: number[]) {
  const literal = toVectorLiteral(vector);
  await db.$executeRaw`UPDATE "Job" SET embedding = ${literal}::vector WHERE id = ${jobId}`;
}

export async function clearEmbedding(db: Pick<PrismaClient, "$executeRaw">, jobId: string) {
  await db.$executeRaw`UPDATE "Job" SET embedding = NULL WHERE id = ${jobId}`;
}

/** Cosine similarity to the resume, highest first. `<=>` is pgvector's cosine distance. */
export async function rankBySimilarity(
  db: PrismaClient,
  jobIds: string[],
  resumeVector: number[],
): Promise<Map<string, number>> {
  if (jobIds.length === 0) return new Map();
  const literal = toVectorLiteral(resumeVector);
  const rows = await db.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS similarity
    FROM "Job"
    WHERE id = ANY(${jobIds}) AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector`;
  return new Map(rows.map((r) => [r.id, r.similarity]));
}
