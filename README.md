# jobfox

A personal job-search pipeline. It finds postings, filters them against hard rules, and (in later phases) scores them against my resume and drafts tailored material for me to review. **I submit every application myself**: jobfox never fills in or submits forms.

**Status:** Phase 1 (discovery, running locally). The Greenhouse, Lever, and Ashby clients are in progress; their tests in `src/sources/ats/*/` are the spec and currently fail on purpose.

## How it works

```
 Adzuna API ─┐
 HN "Who is  ├─► Job[] ─► dedupe ─► hard filters ─► enrich ─► Postgres
   hiring?"  │     (one type     (company +    (keywords,    (full ATS     (Job, JobPosting,
 Known ATS ──┘      for every     title +       location,     description,   Company)
   boards           source)       location)     seniority,    new boards)
                                                blocklist)
```

1. **Sources** each implement `JobSource` and return the shared `Job` type ([src/core](src/core)).
   - **Adzuna**: broad discovery. Descriptions are truncated snippets.
   - **Hacker News**: the latest "Ask HN: Who is hiring?" thread via the Algolia API, parsed heuristically.
   - **Company boards**: any company whose Greenhouse/Lever/Ashby board was discovered earlier is polled directly.
2. **Dedupe** groups postings by a normalized `company | title | location` key.
3. **Filters** ([jobfox.config.ts](jobfox.config.ts)) return a list of reasons rather than a boolean. Rejected jobs are stored with their reasons.
4. **Enrichment** looks for ATS links in jobs that pass, fetches the full posting from the ATS's public API, and records the company's board so later runs poll it.
5. **Persistence** upserts everything idempotently; running twice produces no duplicates.

## Running it

Requires Node 24+, pnpm, and Docker.

```sh
pnpm install
cp .env.example .env        # add Adzuna keys from developer.adzuna.com (optional)
pnpm db:up                  # Postgres 17 + pgvector on localhost:5432
pnpm db:migrate
pnpm discover
```

Without Adzuna keys, `discover` runs with HN and known boards only.

| Script           | What it does                         |
| ---------------- | ------------------------------------ |
| `pnpm discover`  | Fetch, filter, store, print summary  |
| `pnpm test`      | Vitest (no network, no database)     |
| `pnpm check`     | Typecheck + lint + test              |
| `pnpm db:studio` | Browse the database in Prisma Studio |

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

## Respecting sources

- Only official or public APIs: Adzuna's API, HN's Algolia API, and the public job board APIs of Greenhouse, Lever, and Ashby. No LinkedIn or Indeed scraping, nothing that works around CAPTCHAs or bot detection.
- Requests are spaced per host (Adzuna at 2.5s, ATS APIs at 1s) and send an identifying User-Agent.
- Adzuna requires attribution where its jobs are displayed; the Phase 4 dashboard will show "Jobs by Adzuna" and link through `redirect_url`.

## Known limitations

- The HN parser is a heuristic. On the October 2026 thread it parsed 240 of 263 posts (most of the rest are meta comments). About a quarter of the parsed posts don't name a role in the header and are kept with `(role not stated)`.
- `persistGroup` has no integration test against a real database yet.
- EU-hosted Lever boards (`jobs.eu.lever.co`) are not detected.

## Roadmap

1. **Discovery, local** ← current
2. AWS with Terraform: scheduled Lambda, SQS, SSM Parameter Store, GitHub Actions deploy, about $0/month. Prisma 6 needs `linux-arm64-openssl-3.0.x` in `binaryTargets` for Lambda.
3. Fit scoring: pgvector embeddings plus an LLM explanation, evaluated against 20–30 hand-labeled jobs
4. Next.js review dashboard: approve, edit, or skip drafts
5. Application tracking and follow-up reminders
