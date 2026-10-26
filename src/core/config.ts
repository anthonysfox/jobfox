import { z } from "zod";

const phrases = z.array(z.string().trim().min(1)).default([]);

const adzunaSearchSchema = z.object({
  /** Keywords, e.g. "full stack engineer". */
  what: z.string().min(1),
  /** Place name Adzuna understands, e.g. "New York". Omit for US-wide. */
  where: z.string().min(1).optional(),
  distanceKm: z.number().int().positive().optional(),
});

export const configSchema = z.object({
  adzuna: z.object({
    country: z.string().length(2).default("us"),
    searches: z.array(adzunaSearchSchema).min(1),
    maxDaysOld: z.number().int().positive().default(14),
    resultsPerPage: z.number().int().min(1).max(50).default(50),
    maxPagesPerSearch: z.number().int().positive().default(2),
  }),
  hn: z.object({ enabled: z.boolean().default(true) }).prefault({}),
  scoring: z
    .object({
      model: z.string().default("claude-haiku-5-5"),
      effort: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
      /** Only the most resume-similar unscored jobs are sent to the model each run. */
      maxJobsPerRun: z.number().int().positive().default(400),
      concurrency: z.number().int().min(1).max(16).default(4),
      /** What I'm looking for, in my own words. Goes into the scoring prompt. */
      preferences: z.string().default(""),
      /** fitScore cutoffs for the STRONG and POSSIBLE verdicts. */
      strongThreshold: z.number().int().min(0).max(100).default(75),
      possibleThreshold: z.number().int().min(0).max(100).default(50),
    })
    .prefault({}),
  filters: z.object({
    /** The title must contain at least one of these phrases. */
    titleKeywords: phrases,
    /** On-site and hybrid jobs must be in one of these places. */
    locations: phrases,
    remoteOk: z.boolean().default(true),
    /** Reject remote jobs based outside the US, e.g. "Spain" or "Remote (EU)". */
    remoteUsOnly: z.boolean().default(true),
    /** Remote jobs restricted to these regions are rejected. */
    remoteExcludedRegions: phrases,
    /** Titles containing any of these phrases are rejected. */
    seniorityExclude: phrases,
    companyBlocklist: phrases,
  }),
});

export type JobfoxConfig = z.output<typeof configSchema>;
export type FilterConfig = JobfoxConfig["filters"];

/** Identity function that gives jobfox.config.ts autocomplete and type checking. */
export function defineConfig(config: z.input<typeof configSchema>): z.input<typeof configSchema> {
  return config;
}

export function parseConfig(raw: unknown): JobfoxConfig {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid jobfox.config.ts:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

const envSchema = z.object({
  DATABASE_URL: z.url(),
  // Optional so the project runs (HN only) before you have Adzuna keys.
  ADZUNA_APP_ID: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  ADZUNA_APP_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});

export type Env = z.output<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment (see .env.example):\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
