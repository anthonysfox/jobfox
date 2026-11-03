import type { JobfoxConfig } from "../../core/config.ts";
import type { Job } from "../../core/job.ts";
import type { JobSource } from "../../core/source.ts";
import { htmlToText } from "../../lib/html.ts";
import type { HttpClient } from "../../lib/http.ts";
import { inferEmploymentType } from "../../lib/normalize.ts";
import { himalayasSearchResponseSchema, type HimalayasJob } from "./schema.ts";

export const HIMALAYAS_HOST = "himalayas.app";
const PAGE_SIZE = 20;

/**
 * Himalayas is remote-only. The location filters read "Remote (US)" as
 * US-eligible, and a list of other countries as outside the US.
 */
export function formatLocation(restrictions: string[] | null | undefined): string {
  if (!restrictions || restrictions.length === 0) return "Remote (Worldwide)";
  if (restrictions.includes("United States")) return "Remote (US)";
  return `Remote (${restrictions.slice(0, 3).join(", ")}${restrictions.length > 3 ? ", …" : ""})`;
}

export function toJob(job: HimalayasJob): Job {
  const description = htmlToText(job.description);
  // Salary has no period, so an hourly or monthly rate can't be stored without misleading the pay check.
  const annual = job.salaryPeriod === "annual" && (job.minSalary != null || job.maxSalary != null);

  return {
    source: "HIMALAYAS",
    externalId: job.guid,
    url: job.applicationLink,
    // Left empty so enrichment doesn't swap their link for an ATS one; see canonicalize.
    applyUrl: null,
    title: job.title,
    companyName: job.companyName,
    location: formatLocation(job.locationRestrictions),
    workplaceType: "REMOTE",
    employmentType: inferEmploymentType({
      label: job.employmentType,
      title: job.title,
      description,
    }),
    description: description || null,
    descriptionTruncated: false,
    salary: annual
      ? { min: job.minSalary ?? null, max: job.maxSalary ?? null, currency: job.currency ?? null }
      : null,
    postedAt: new Date(job.pubDate * 1000),
    raw: job,
  };
}

export function buildSearchUrl(
  config: JobfoxConfig["himalayas"],
  query: string,
  page: number,
  employmentType: string | undefined,
): URL {
  const url = new URL(`https://${HIMALAYAS_HOST}/jobs/api/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("country", config.country);
  if (employmentType) url.searchParams.set("employment_type", employmentType);
  url.searchParams.set("page", String(page));
  return url;
}

export interface HimalayasSourceOptions {
  http: HttpClient;
  config: JobfoxConfig["himalayas"];
  /** Overrides config.employmentType with "Contractor". */
  contractOnly?: boolean;
  now?: () => Date;
}

export function createHimalayasSource({
  http,
  config,
  contractOnly = false,
  now = () => new Date(),
}: HimalayasSourceOptions): JobSource {
  const employmentType = contractOnly ? "Contractor" : config.employmentType;
  return {
    name: "himalayas",
    async fetchJobs() {
      const jobs = new Map<string, Job>();
      const nowSeconds = now().getTime() / 1000;

      for (const query of config.searches) {
        for (let page = 1; page <= config.maxPagesPerSearch; page++) {
          const response = await http.getJson(
            buildSearchUrl(config, query, page, employmentType),
            himalayasSearchResponseSchema,
          );
          for (const result of response.jobs) {
            // Their terms: remove jobs once they expire.
            if (result.expiryDate != null && result.expiryDate < nowSeconds) continue;
            jobs.set(result.guid, toJob(result));
          }
          if (response.jobs.length < PAGE_SIZE) break;
        }
      }

      return [...jobs.values()];
    },
  };
}
