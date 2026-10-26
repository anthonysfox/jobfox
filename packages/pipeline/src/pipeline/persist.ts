import type { Ats, Source } from "../core/job.ts";
import { Prisma, type Company, type PrismaClient } from "../lib/db.ts";
import { normalizeCompany } from "../lib/normalize.ts";
import { clearEmbedding } from "../scoring/store.ts";
import { canonicalize, mergeCanonical, type CanonicalJob, type JobGroup } from "./dedupe.ts";

type Tx = Prisma.TransactionClient;

export interface Board {
  ats: Ats;
  slug: string;
}

export interface PersistResult {
  jobId: string;
  isNew: boolean;
  canonical: CanonicalJob;
  rejectedReasons: string[];
  /** True when this run attached a board to a company that had none. */
  boardAdded: boolean;
}

const jobWithCompany = { company: true } satisfies Prisma.JobInclude;
type ExistingJob = Prisma.JobGetPayload<{ include: typeof jobWithCompany }>;

function toCanonical(job: ExistingJob): CanonicalJob {
  return {
    companyName: job.company.name,
    title: job.title,
    location: job.location,
    workplaceType: job.workplaceType,
    description: job.description,
    descriptionSource: job.descriptionSource,
    applyUrl: job.applyUrl,
    salary:
      job.salaryMin !== null || job.salaryMax !== null
        ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency }
        : null,
    postedAt: job.postedAt,
  };
}

function jobFields(canonical: CanonicalJob, rejectedReasons: string[]) {
  return {
    title: canonical.title,
    location: canonical.location,
    workplaceType: canonical.workplaceType,
    description: canonical.description,
    descriptionSource: canonical.descriptionSource,
    applyUrl: canonical.applyUrl,
    salaryMin: canonical.salary?.min ?? null,
    salaryMax: canonical.salary?.max ?? null,
    salaryCurrency: canonical.salary?.currency ?? null,
    postedAt: canonical.postedAt,
    rejectedReasons,
  };
}

/**
 * Identity resolution: a posting we've stored before pins the job, even if
 * normalization would now produce a different key. Otherwise fall back to the key.
 */
async function findExistingJob(tx: Tx, group: JobGroup): Promise<ExistingJob | null> {
  const posting = await tx.jobPosting.findFirst({
    where: { OR: group.postings.map((p) => ({ source: p.source, externalId: p.externalId })) },
    select: { jobId: true },
  });
  if (posting) {
    return tx.job.findUnique({ where: { id: posting.jobId }, include: jobWithCompany });
  }
  return tx.job.findUnique({ where: { dedupeKey: group.key }, include: jobWithCompany });
}

/** Prefer the job's existing company, then the company that owns this board, then match by name. */
async function resolveCompany(
  tx: Tx,
  existing: ExistingJob | null,
  name: string,
  board: Board | null,
  discoveredVia: Source,
): Promise<Company> {
  if (existing) return existing.company;
  if (board) {
    const owner = await tx.company.findUnique({
      where: { ats_atsSlug: { ats: board.ats, atsSlug: board.slug } },
    });
    if (owner) return owner;
  }
  const normalizedName = normalizeCompany(name);
  return tx.company.upsert({
    where: { normalizedName },
    create: { name, normalizedName, discoveredVia },
    update: {},
  });
}

/** Record a newly discovered board so the company gets polled. Returns true if it was new. */
async function attachBoard(tx: Tx, company: Company, board: Board | null): Promise<boolean> {
  if (!board || company.ats) return false;
  const owner = await tx.company.findUnique({
    where: { ats_atsSlug: { ats: board.ats, atsSlug: board.slug } },
  });
  if (owner) return false;
  await tx.company.update({
    where: { id: company.id },
    data: { ats: board.ats, atsSlug: board.slug },
  });
  return true;
}

export async function persistGroup(
  db: PrismaClient,
  group: JobGroup,
  options: {
    board: Board | null;
    filter: (job: CanonicalJob) => string[];
    now?: Date;
  },
): Promise<PersistResult> {
  const now = options.now ?? new Date();
  const first = group.postings[0];
  if (!first) throw new Error("persistGroup() needs at least one posting");

  return db.$transaction(async (tx) => {
    const existing = await findExistingJob(tx, group);
    const incoming = canonicalize(group.postings);
    const canonical = existing ? mergeCanonical(toCanonical(existing), incoming) : incoming;
    const rejectedReasons = options.filter(canonical);

    const company = await resolveCompany(
      tx,
      existing,
      canonical.companyName,
      options.board,
      first.source,
    );
    const boardAdded = await attachBoard(tx, company, options.board);

    const job = existing
      ? await tx.job.update({
          where: { id: existing.id },
          data: { ...jobFields(canonical, rejectedReasons), lastSeenAt: now },
        })
      : await tx.job.create({
          data: {
            ...jobFields(canonical, rejectedReasons),
            dedupeKey: group.key,
            companyId: company.id,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });

    // A better description (e.g. ATS replacing an Adzuna snippet) makes the embedding stale.
    if (existing && existing.description !== canonical.description) {
      await clearEmbedding(tx, job.id);
    }

    for (const p of group.postings) {
      const fields = {
        url: p.url,
        title: p.title,
        companyName: p.companyName,
        location: p.location,
        description: p.description,
        descriptionTruncated: p.descriptionTruncated,
        raw: (p.raw ?? {}) as Prisma.InputJsonValue,
        lastSeenAt: now,
      };
      await tx.jobPosting.upsert({
        where: { source_externalId: { source: p.source, externalId: p.externalId } },
        create: {
          ...fields,
          source: p.source,
          externalId: p.externalId,
          jobId: job.id,
          firstSeenAt: now,
        },
        update: fields,
      });
    }

    return {
      jobId: job.id,
      isNew: !existing,
      canonical,
      rejectedReasons,
      boardAdded,
    };
  });
}

/** Companies with a known board, to poll directly as sources. */
export function listPollableCompanies(db: PrismaClient) {
  return db.company.findMany({
    where: { pollEnabled: true, ats: { not: null }, atsSlug: { not: null } },
    orderBy: { lastPolledAt: { sort: "asc", nulls: "first" } },
  });
}

export function markPolled(db: PrismaClient, companyIds: string[], now = new Date()) {
  return db.company.updateMany({ where: { id: { in: companyIds } }, data: { lastPolledAt: now } });
}
