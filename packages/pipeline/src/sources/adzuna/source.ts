import type { JobfoxConfig } from "../../core/config.ts";
import type { Job } from "../../core/job.ts";
import type { JobSource } from "../../core/source.ts";
import { htmlToText } from "../../lib/html.ts";
import type { HttpClient } from "../../lib/http.ts";
import { containsPhrase, inferEmploymentType, inferWorkplaceType } from "../../lib/normalize.ts";
import { searchAdzuna, type AdzunaCredentials } from "./client.ts";
import type { AdzunaJob } from "./schema.ts";

const CURRENCY_BY_COUNTRY: Record<string, string> = { us: "USD", gb: "GBP", ca: "CAD" };

/**
 * Adzuna's display_name is "City, County" with no state, so append the state
 * and country from `area` (["US", "New Jersey", "Middlesex County", ...]).
 * Location filters need them; the dedupe key only uses the first segment.
 */
export function formatLocation(location: AdzunaJob["location"]): string | null {
  const name = location?.display_name;
  if (!name) return null;
  const [country, state] = location.area ?? [];
  const extra = [state, country].filter(
    (part): part is string => part !== undefined && !containsPhrase(name, part),
  );
  return [name, ...extra].join(", ");
}

export function toJob(result: AdzunaJob, country: string): Job | null {
  const companyName = result.company?.display_name?.trim();
  if (!companyName) return null;

  const title = htmlToText(result.title);
  const location = formatLocation(result.location);
  const description = htmlToText(result.description);
  // Predicted salaries are Adzuna's estimate, not the employer's; don't store them as fact.
  const hasRealSalary =
    result.salary_is_predicted !== "1" &&
    (result.salary_min !== undefined || result.salary_max !== undefined);

  return {
    source: "ADZUNA",
    externalId: result.id,
    // Adzuna's terms require linking through redirect_url, so keep it as the posting URL.
    url: result.redirect_url,
    applyUrl: null,
    title,
    companyName,
    location,
    workplaceType: inferWorkplaceType(title, location, description),
    employmentType: inferEmploymentType({ label: result.contract_type, title, description }),
    description: description || null,
    // The search API only returns a snippet.
    descriptionTruncated: true,
    salary: hasRealSalary
      ? {
          min: result.salary_min ?? null,
          max: result.salary_max ?? null,
          currency: CURRENCY_BY_COUNTRY[country] ?? null,
        }
      : null,
    postedAt: new Date(result.created),
    raw: result,
  };
}

export interface AdzunaSourceOptions {
  http: HttpClient;
  credentials: AdzunaCredentials;
  config: JobfoxConfig["adzuna"];
  /**
   * Adds "contract" to every search. A keyword rather than Adzuna's contract=1,
   * which only returns jobs Adzuna has labeled and misses the many it hasn't.
   */
  contractOnly?: boolean;
}

export function createAdzunaSource({
  http,
  credentials,
  config,
  contractOnly = false,
}: AdzunaSourceOptions): JobSource {
  return {
    name: "adzuna",
    async fetchJobs() {
      // The same job often shows up in several searches.
      const jobs = new Map<string, Job>();

      for (const search of config.searches) {
        for (let page = 1; page <= config.maxPagesPerSearch; page++) {
          const response = await searchAdzuna(http, credentials, {
            country: config.country,
            page,
            what: contractOnly ? `${search.what} contract` : search.what,
            where: search.where,
            distanceKm: search.distanceKm,
            maxDaysOld: config.maxDaysOld,
            resultsPerPage: config.resultsPerPage,
          });

          for (const result of response.results) {
            const job = toJob(result, config.country);
            if (job) jobs.set(job.externalId, job);
          }
          if (response.results.length < config.resultsPerPage) break;
        }
      }

      return [...jobs.values()];
    },
  };
}
