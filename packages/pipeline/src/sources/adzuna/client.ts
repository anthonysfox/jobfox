import type { HttpClient } from "../../lib/http.js";
import { adzunaSearchResponseSchema, type AdzunaSearchResponse } from "./schema.js";

export const ADZUNA_HOST = "api.adzuna.com";

export interface AdzunaCredentials {
  appId: string;
  appKey: string;
}

export interface AdzunaSearchParams {
  country: string;
  page: number;
  what: string;
  where?: string | undefined;
  distanceKm?: number | undefined;
  maxDaysOld: number;
  resultsPerPage: number;
}

export function buildSearchUrl(credentials: AdzunaCredentials, params: AdzunaSearchParams): URL {
  const url = new URL(`https://${ADZUNA_HOST}/v1/api/jobs/${params.country}/search/${params.page}`);
  const query = url.searchParams;
  query.set("app_id", credentials.appId);
  query.set("app_key", credentials.appKey);
  query.set("what", params.what);
  if (params.where) query.set("where", params.where);
  if (params.distanceKm) query.set("distance", String(params.distanceKm));
  query.set("max_days_old", String(params.maxDaysOld));
  query.set("results_per_page", String(params.resultsPerPage));
  query.set("sort_by", "date");
  return url;
}

export function searchAdzuna(
  http: HttpClient,
  credentials: AdzunaCredentials,
  params: AdzunaSearchParams,
): Promise<AdzunaSearchResponse> {
  return http.getJson(buildSearchUrl(credentials, params), adzunaSearchResponseSchema);
}
