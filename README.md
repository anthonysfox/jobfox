# jobfox

A personal job-search pipeline. It finds postings, filters them against hard rules, scores them against my resume, and (in later phases) drafts tailored material for me to review. **I submit every application myself**: jobfox never fills in or submits forms.

**Status:** Phase 1 (discovery) works: Adzuna, Hacker News, and direct polling of Greenhouse, Lever, and Ashby boards. Phase 3 (fit scoring with an eval) is built and being evaluated against my hand labels. A local dashboard (the first part of Phase 4) shows scored jobs, labeling, and eval results.

## How it works

```
 Adzuna API ─┐
 HN "Who is  ├─► Job[] ─► dedupe ─► hard filters ─► enrich ─► Postgres
   hiring?"  │     (one type     (company +    (keywords,    (full ATS     (Job, JobPosting,
 Known ATS ──┘      for every     title +       location,     description,   Company)
   boards           source)       location)     seniority,    new boards)
                                                blocklist)
```

1. **Sources** each implement `JobSource` and return the shared `Job` type ([packages/pipeline/src/core](packages/pipeline/src/core)).
   - **Adzuna**: broad discovery. Descriptions are truncated snippets.
   - **Hacker News**: the latest "Ask HN: Who is hiring?" thread via the Algolia API, parsed heuristically.
   - **Company boards**: any company whose Greenhouse/Lever/Ashby board was discovered earlier is polled directly.
2. **Dedupe** groups postings by a normalized `company | title | location` key.
3. **Filters** ([jobfox.config.ts](packages/pipeline/jobfox.config.ts)) return a list of reasons rather than a boolean. Rejected jobs are stored with their reasons.
4. **Enrichment** looks for ATS links in jobs that pass, fetches the full posting from the ATS's public API, and records the company's board so later runs poll it.
5. **Persistence** upserts everything idempotently; running twice produces no duplicates.

### Scoring

```
 matches ─► embed (local bge-small) ─► rank by similarity ─► Claude scores top N ─► JobScore
                 pgvector column          to my resume         structured output
```

1. Every job that passes the filters gets a local embedding (`bge-small-en-v1.5` via transformers.js, stored in a pgvector column).
2. Jobs are ranked by cosine similarity to my resume. This is free and fast but only measures topic overlap.
3. The most similar unscored jobs go to Claude (Haiku 5.5 by default) with my resume, my preferences, and a rubric. It returns a 0–100 fit score, strengths, gaps, and a one-line summary as validated JSON.
4. `pnpm label` and `pnpm eval` measure the scorer against my own judgment of 20–30 jobs.

### Dashboard

`pnpm web` starts a Next.js app on `localhost:3000` that reads the same database:

- **Jobs:** tabs for strong, possible, and weak fits plus saved and applied, filterable by area, description source, and minimum score. Save, Applied, and Skip update the job's status.
- **Job detail:** the full description beside the model's strengths and gaps.
- **Label:** blind labeling for the eval, one job at a time with keyboard shortcuts.
- **Eval:** the latest eval run, with a confusion matrix and every disagreement.

## Repository layout

```
packages/pipeline/   discovery, filtering, scoring, CLI scripts, Prisma schema
apps/web/            Next.js dashboard; imports the pipeline's TypeScript source
```

## Running it

Requires Node 24+, pnpm, and Docker.

```sh
pnpm install
cp .env.example .env        # add Adzuna keys from developer.adzuna.com (optional)
pnpm db:up                  # Postgres 17 + pgvector on localhost:5432
pnpm db:migrate
pnpm discover
```

Without Adzuna keys, `discover` runs with HN and known boards only. Scoring needs `ANTHROPIC_API_KEY` in `.env` and a resume at `packages/pipeline/data/resume.md` (gitignored).

| Script           | What it does                                |
| ---------------- | ------------------------------------------- |
| `pnpm web`       | Dashboard on localhost:3000                 |
| `pnpm discover`  | Fetch, filter, store, print summary         |
| `pnpm matches`   | Jobs to apply to, best fit first            |
| `pnpm score`     | Embed and score new matches (`--limit N`)   |
| `pnpm label`     | Hand-label jobs for the eval (blind)        |
| `pnpm eval`      | Measure the scorer (`--model X` to compare) |
| `pnpm test`      | Vitest (no network, no database)            |
| `pnpm check`     | Typecheck + lint + test                     |
| `pnpm db:studio` | Browse the database in Prisma Studio        |

## Design decisions

**`Job` vs. `JobPosting`.** A `Job` is one real-world role after dedupe; a `JobPosting` is one sighting of it in one source, with the raw payload. That keeps provenance, makes upserts idempotent on `(source, externalId)`, and lets a full ATS description replace a truncated Adzuna one without losing either.

**Dedupe prefers missing a merge to making a wrong one.** A missed merge shows me a duplicate; a wrong merge hides a job. So normalization only removes formatting differences (legal suffixes, "Full-Stack" vs. "Fullstack", "NYC" vs. "New York, NY") and keeps level markers and team names in the key.

**Identity is resolved by posting first, key second.** If any incoming posting was stored before, it pins the job even if normalization rules have changed since. This stops one job splitting into two across runs.

**Rejected jobs are stored with reasons.** Filters can be tuned and re-run without fetching again, the summary shows why jobs were dropped, and the rejects become negative examples for the Phase 3 evaluation set.

**Hard filters reject only on known facts.** A job with no stated location or role goes to review rather than being dropped.

**Adzuna redirect links are never followed automatically.** `redirect_url` is a tracked click that advertisers may pay for. Resolving hundreds by script would inflate their numbers and likely break Adzuna's terms. Adzuna jobs are upgraded when they merge with an HN post or a polled ATS board instead.

**Zod at every boundary.** API responses, environment, and config are validated where they enter the system. A changed API shape fails with a field path instead of writing `undefined` to the database. Schemas are loose objects so the raw payload keeps fields we don't model.

**Injected `HttpClient`.** One small wrapper over native `fetch` handles per-host rate limiting, retries on 429/5xx with `Retry-After`, timeouts, and credential redaction in errors. Sources receive it as a parameter, so tests use an in-memory fake with recorded-shape fixtures: no network and no mocking library.

**Sources fail independently.** `Promise.allSettled`: if one source is down, the others still run, and the summary says which failed.

**Domain types don't import Prisma.** `src/core` is plain TypeScript. The persistence layer maps to Prisma, and the compiler checks the string unions stay in sync with the generated enums.

### Scoring decisions

**Two stages: free embeddings, then a model call.** Embeddings rank every job at no cost, and only the most similar unscored jobs (`scoring.maxJobsPerRun`) reach the model. Scores are stored per job, so a job is scored once.

**Scores are keyed by a hash of the whole system prompt.** Changing the resume, my stated preferences, or the rubric re-scores everything; nothing else does.

**The model returns a number; code decides the verdict.** STRONG/POSSIBLE/WEAK come from configurable thresholds on `fitScore`, so the verdict can't contradict the score and the cutoffs can be tuned against the eval.

**Check `stop_reason`, then validate.** A response cut off by `max_tokens` or declined by a safety classifier is recorded as a failure, never parsed. The JSON is validated with the same Zod schema that generated the structured-output format.

**Prompt caching.** The resume, preferences, and rubric form a cached system prompt; each job goes in the user turn. One request runs alone first so the cache exists before the rest run in parallel.

**Job postings are untrusted input.** The prompt tells the model to treat posting text as data, and structured output limits what it can return.

**The eval is blind and includes an embeddings-only baseline.** Labels are made without seeing the model's score, on jobs spread across the similarity range. The eval reports rank correlation for both the model and raw similarity: if the model can't beat the free baseline, it isn't worth paying for.

### Dashboard decisions

**One workspace, shared source.** The dashboard imports the pipeline's TypeScript directly (an `exports` map plus `transpilePackages`), so there's one Prisma schema, one client, and one set of types.

**Server components and server actions, no API.** Pages query Prisma on the server. Buttons are plain forms bound to server actions, so they work without client-side JavaScript; the only client component adds the labeling shortcuts. Actions validate their input with Zod, because a server action is a public endpoint.

**Imports name real files.** The pipeline imports `./filters.ts`, not `./filters.js`. Turbopack doesn't map `.js` to `.ts` the way TypeScript's NodeNext resolution does, and Node's built-in TypeScript support expects real extensions anyway.

## Respecting sources

- Only official or public APIs: Adzuna's API, HN's Algolia API, and the public job board APIs of Greenhouse, Lever, and Ashby. No LinkedIn or Indeed scraping, nothing that works around CAPTCHAs or bot detection.
- Requests are spaced per host (Adzuna at 2.5s, ATS APIs at 1s) and send an identifying User-Agent.
- Adzuna requires attribution where its jobs are displayed; the Phase 4 dashboard will show "Jobs by Adzuna" and link through `redirect_url`.

## Known limitations

- The HN parser is a heuristic. On the October 2026 thread it parsed 240 of 263 posts (most of the rest are meta comments). About a quarter of the parsed posts don't name a role in the header and are kept with `(role not stated)`.
- `persistGroup` has no integration test against a real database yet.
- EU-hosted Lever boards (`jobs.eu.lever.co`) are not detected.
- Adzuna jobs only have a description snippet, so their scores rest on less information. The prompt tells the model so.
- The embedding model reads at most 512 tokens, so long postings and the resume are embedded from their beginnings only. That's fine for coarse ranking; the model call sees the full text.
- A stored score isn't refreshed when a job's description later improves (for example when its ATS posting is found); only the embedding is.

## Roadmap

1. **Discovery, local** ✓
2. AWS with Terraform: scheduled Lambda, SQS, SSM Parameter Store, GitHub Actions deploy, about $0/month. Prisma 6 needs `linux-arm64-openssl-3.0.x` in `binaryTargets` for Lambda, and the embedding model (~35 MB) and onnxruntime need a container-image Lambda.
3. **Fit scoring**: pgvector embeddings plus an LLM explanation, evaluated against 20–30 hand-labeled jobs ← current
4. **Next.js review dashboard**: scored jobs, status, labeling, and eval are done; tailored resume bullets and draft answers are next
5. Application tracking and follow-up reminders
