import "server-only";
import { createDb, type PrismaClient } from "@jobfox/pipeline/lib/db";

// Next's dev server re-evaluates modules on every edit; reuse one client
// instead of opening a new connection pool each time.
const globalForDb = globalThis as unknown as { jobfoxDb?: PrismaClient };

export const db = globalForDb.jobfoxDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.jobfoxDb = db;
