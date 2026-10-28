# jobfox

A personal job-search pipeline. It finds postings, filters them against hard rules, scores them against my resume, and drafts tailored resume bullets and application answers for me to review. **I submit every application myself**: jobfox never fills in or submits forms.

**Status:** Phases 1, 3, and 4 work locally: discovery from Adzuna, Hacker News, and Greenhouse/Lever/Ashby boards; fit scoring with an eval against my hand labels; and a dashboard for triage, labeling, eval results, and application drafts. Next are AWS deployment (Phase 2) and application tracking (Phase 5).

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

### Drafting

For a job I'm applying to, I paste the application form's questions into the job page (or run `pnpm draft <job id>`). Claude (Sonnet 5.5) gets my resume, an optional profile (`data/profile.md`: more detail than fits on a resume, with accuracy notes such as "I built the configuration surface, not the AI detection"), the posting, and the scorer's strengths and gaps, and returns:

- A summary rewritten for this posting, 2–3 sentences, each naming the resume or profile lines it's based on.
- 3–6 of my resume bullets, rewritten to lead with what this posting cares about, each paired with the original line it came from.
- Up to 5 new bullets from profile facts the resume leaves out, most relevant first, each naming its source line and the resume entry it goes under.
- An answer to each question, with bracketed placeholders such as `[your salary expectations]` where the resume doesn't have the facts.

Code then checks each bullet: a rewrite's original line must exist in my resume, a new bullet's source must exist in my resume or profile and its entry on my resume, and no bullet may contain numbers that appear in neither. Each summary sentence's sources must exist, and its numbers must appear in those sources. Problems show next to the bullet. I edit what I keep and paste it into the real form myself.

From a draft, the job page's **Tailored resume (PDF)** button (or `pnpm resume <job id>`) builds a one-page PDF of my resume with the tailored summary and rewrites swapped in, the most relevant first within each role, as many new bullets as fit on the page, and the skills the posting mentions listed first on each skills line. Email, phone, and links (such as a personal site) come from `RESUME_EMAIL`, `RESUME_PHONE`, and `RESUME_LINKS` in `.env`; editing `data/resume.md` instead would change the scoring prompt and re-score every job.

### Dashboard

`pnpm web` starts a Next.js app on `localhost:3000` that reads the same database:

- **Jobs:** tabs for strong, possible, and weak fits plus saved and applied, filterable by area, description source, and minimum score. Save, Applied, and Skip update the job's status.
- **Job detail:** the full description beside the model's strengths and gaps, plus the application draft panel with copy buttons.
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
| `pnpm draft ID`  | Draft bullets and answers for one job       |
| `pnpm resume ID` | Tailored resume PDF from the latest draft   |
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

**Titles decide what's in scope; scoring decides what's good.** The title filter is a broad allowlist of role phrases, including the titles non-tech employers use ("Application Developer", "Programmer Analyst") and client-facing engineering roles. Things a title can't show, such as a sales quota, the industry, or whether the work is hands-on, go to the model as preferences. Interests like music and media are a plus in scoring rather than a filter, so a strong role elsewhere isn't hidden. The rubric also says outright that an employer's industry isn't a gap unless the posting requires domain knowledge, so a bank's React role isn't marked down for being at a bank. Non-software roles I'd consider (AV programming, show control, project coordination) are scored on transferable experience, but missing licenses or trade experience still count as gaps.

**Adzuna redirect links are never followed automatically.** `redirect_url` is a tracked click that advertisers may pay for. Resolving hundreds by script would inflate their numbers and likely break Adzuna's terms. Adzuna jobs are upgraded when they merge with an HN post or a polled ATS board instead.

**Zod at every boundary.** API responses, environment, and config are validated where they enter the system. A changed API shape fails with a field path instead of writing `undefined` to the database. Schemas are loose objects so the raw payload keeps fields we don't model.

**Injected `HttpClient`.** One small wrapper over native `fetch` handles per-host rate limiting, retries on 429/5xx with `Retry-After`, timeouts, and credential redaction in errors. Sources receive it as a parameter, so tests use an in-memory fake with recorded-shape fixtures: no network and no mocking library.

**Sources fail independently.** `Promise.allSettled`: if one source is down, the others still run, and the summary says which failed.

**Domain types don't import Prisma.** `src/core` is plain TypeScript. The persistence layer maps to Prisma, and the compiler checks the string unions stay in sync with the generated enums.

### Scoring decisions

**Two stages: free embeddings, then a model call.** Embeddings rank every job at no cost, and only the most similar unscored jobs (`scoring.maxJobsPerRun`) reach the model. Scores are stored per job, so a job is scored once.

**Scores are keyed by a hash of the whole system prompt.** Changing the resume, my stated preferences, or the rubric re-scores everything; nothing else does.

**The model returns a number; code decides the verdict.** STRONG/POSSIBLE/WEAK come from configurable thresholds on `fitScore`, applied when scores are read rather than stored, so retuning the cutoffs re-sorts every job without another model call. The first eval (11 labels) showed the model ranked well (Spearman 0.86, against 0.43 for embeddings alone) but the cutoffs were too strict, so they moved from 75/50 to 60/35.

**Check `stop_reason`, then validate.** A response cut off by `max_tokens` or declined by a safety classifier is recorded as a failure, never parsed. The JSON is validated with the same Zod schema that generated the structured-output format.

**Prompt caching.** The resume, preferences, and rubric form a cached system prompt; each job goes in the user turn. One request runs alone first so the cache exists before the rest run in parallel.

**Job postings are untrusted input.** The prompt tells the model to treat posting text as data, and structured output limits what it can return.

**The eval is blind and includes an embeddings-only baseline.** Labels are made without seeing the model's score, on jobs spread across the similarity range. The eval reports rank correlation for both the model and raw similarity: if the model can't beat the free baseline, it isn't worth paying for.

### Drafting decisions

**A stronger model for drafting than for scoring.** Scoring runs on hundreds of jobs, so it uses Haiku. Drafting runs on the few jobs I actually apply to, and the writing quality matters, so it uses Sonnet. A draft costs about two cents.

**Don't trust the model's claims about the resume; check them.** The prompt forbids inventing experience, but the real guard is in code: each bullet must quote the resume line it rewrites, so a program can confirm that line exists and that no new numbers appeared. Those checks are deterministic, cheap, and tested, and anything they flag is shown rather than silently dropped.

**Answers are keyed to my questions by position.** The model's echo of each question is ignored, so a reworded or skipped question can't shift answers onto the wrong question.

**The tailored resume is built by code, not written by the model.** The PDF is my own resume Markdown with plain string edits: drafted bullets replace the lines they name, flagged bullets are skipped, and skills are reordered but never added. The model can't change my titles or dates, and the same draft always produces the same resume. Rendering uses pdfkit with built-in Helvetica: no headless browser, and the text stays selectable for applicant tracking systems.

**The summary is checked sentence by sentence.** A summary combines facts from several lines, which is where a draft is most likely to stretch: in testing, one moved "hundreds of clients" from the apps I rewrote onto "customer-facing work". Each sentence cites its own sources, so code can require its numbers to come from those lines, not just from somewhere on the resume. Numbers include spelled-out counts ("six years", "hundreds"), which a digits-only check would miss. A flagged summary is never used; the PDF keeps my original. The check can't judge meaning, so a claim with no number in it still needs my read.

**The model ranks; code fits the page.** The tailored summary comes first, since it's what a reader sees first; if it alone overflows the page, the original is kept. New bullets come back in order of relevance, and the PDF builder adds them one at a time, rendering and counting pages, until the next one would spill onto a second page. Rendering takes milliseconds, so measuring is simpler and more exact than estimating text height.

**Contact details never reach the model.** They're kept out of `data/resume.md`, which goes into every prompt, and are added only when the PDF is rendered.

**Drafts are kept, not overwritten.** Each run saves a new `ApplicationDraft` with the model, prompt hash, and cost, and the page shows the latest. Nothing is ever submitted; the panel only has copy buttons.

### Dashboard decisions

**One workspace, shared source.** The dashboard imports the pipeline's TypeScript directly (an `exports` map plus `transpilePackages`), so there's one Prisma schema, one client, and one set of types.

**Server components and server actions, no API.** Pages query Prisma on the server. Status and label buttons are plain forms bound to server actions, so they work without client-side JavaScript. Client components are limited to the labeling shortcuts, copy buttons, and the draft form's pending state. Actions validate their input with Zod, because a server action is a public endpoint.

**Imports name real files.** The pipeline imports `./filters.ts`, not `./filters.js`. Turbopack doesn't map `.js` to `.ts` the way TypeScript's NodeNext resolution does, and Node's built-in TypeScript support expects real extensions anyway.

## Respecting sources

- Only official or public APIs: Adzuna's API, HN's Algolia API, and the public job board APIs of Greenhouse, Lever, and Ashby. No LinkedIn or Indeed scraping, nothing that works around CAPTCHAs or bot detection.
- Requests are spaced per host (Adzuna at 2.5s, ATS APIs at 1s) and send an identifying User-Agent.
- Adzuna requires attribution where its jobs are displayed; the dashboard shows "Jobs by Adzuna" on those jobs and links through `redirect_url`.

## Known limitations

- The HN parser is a heuristic. On the October 2026 thread it parsed 240 of 263 posts (most of the rest are meta comments). About a quarter of the parsed posts don't name a role in the header and are kept with `(role not stated)`.
- `persistGroup` has no integration test against a real database yet.
- EU-hosted Lever boards (`jobs.eu.lever.co`) are not detected.
- Adzuna jobs only have a description snippet, so their scores rest on less information. The prompt tells the model so.
- The embedding model reads at most 512 tokens, so long postings and the resume are embedded from their beginnings only. That's fine for coarse ranking; the model call sees the full text.
- A stored score isn't refreshed when a job's description later improves (for example when its ATS posting is found); only the embedding is.
- The eval so far rests on 11 labels. The thresholds will move as more accumulate.
- The draft form needs JavaScript. Submitted without it, the draft is saved but the response never arrives.

## Roadmap

1. **Discovery, local** ✓
2. AWS with Terraform: scheduled Lambda, SQS, SSM Parameter Store, GitHub Actions deploy, about $0/month. Prisma 6 needs `linux-arm64-openssl-3.0.x` in `binaryTargets` for Lambda, and the embedding model (~35 MB) and onnxruntime need a container-image Lambda.
3. **Fit scoring** ✓: pgvector embeddings plus an LLM explanation, evaluated against hand-labeled jobs
4. **Next.js review dashboard** ✓: triage, labeling, eval results, and tailored resume bullets and draft answers
5. Application tracking and follow-up reminders
