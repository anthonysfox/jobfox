import { UNKNOWN_TITLE, type Job } from "../../core/job.ts";
import { extractUrls, htmlToText } from "../../lib/html.ts";
import { inferWorkplaceType } from "../../lib/normalize.ts";
import type { HnComment } from "./schema.ts";

/*
 * Who's Hiring posts loosely follow "Company | Role | Location | ..." on the
 * first line, with "|" or "—" as separators. This is a heuristic for the
 * common shapes. Posts that never name a role get UNKNOWN_TITLE, which the
 * filters treat as unknown rather than as a mismatch.
 */

const ROLE =
  /\b(engineers?|engineering|eng|developers?|swe|sre|architects?|designers?|scientists?|programmers?|devops|consultants?|technologists?|leads?|managers?|head of|member of technical staff|full-?stack|front-?end|back-?end|roles?|positions?|openings?)\b/i;
const SALARY = /[$€£]|\b\d+k\b/i;
const WORKPLACE = /\b(remote|onsite|on-site|hybrid|in[- ]office)/i;
const PLACE =
  /\b(nyc|new york|sf|san francisco|bay area|boston|seattle|austin|chicago|los angeles|denver|london|berlin|toronto|usa?|uk|canada|europe|emea)\b|\b[A-Z][a-z]+, [A-Z]{2}\b/i;
const CAREERS_LINK = /greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|\/careers|\/jobs/i;
const NOT_AN_APPLY_LINK = /news\.ycombinator\.com|linkedin\.com\/in\//i;

function isLocation(segment: string): boolean {
  return WORKPLACE.test(segment) || PLACE.test(segment);
}

function splitSegments(firstLine: string): string[] {
  return firstLine
    .split(/\s*\|\s*|\s+[—–]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function withoutUrls(segment: string): string {
  return segment.replace(/https?:\/\/\S+/g, "").trim();
}

function splitOn(segment: string, separator: RegExp): string[] | null {
  const parts = segment
    .split(separator)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 && parts.every((p) => ROLE.test(p)) ? parts : null;
}

/**
 * "Frontend Engineer, Backend Engineer" -> two roles. Only splits when every
 * piece looks like a role, so "Software Engineer, Payments" stays one.
 */
function splitRoles(segment: string): string[] {
  if (/[,;]/.test(segment)) return splitOn(segment, /[,;]/) ?? [segment];
  return splitOn(segment, /\s+&\s+|\s+and\s+/) ?? [segment];
}

function pickApplyUrl(text: string): string | null {
  const urls = extractUrls(text).filter((u) => !NOT_AN_APPLY_LINK.test(u));
  return urls.find((u) => CAREERS_LINK.test(u)) ?? urls[0] ?? null;
}

export interface ParsedHeader {
  company: string;
  roles: string[];
  location: string | null;
}

export function parseHeader(firstLine: string): ParsedHeader | null {
  const [head, ...others] = splitSegments(firstLine);
  const rest = others.map(withoutUrls).filter(Boolean);
  if (!head || others.length === 0) return null;

  // "PrairieLearn (Remote US)" -> company "PrairieLearn", location hint "Remote US".
  const hints = [...head.matchAll(/\(([^)]*)\)/g)].map((m) => m[1] ?? "");
  const company = withoutUrls(head.replace(/\([^)]*\)/g, ""));
  if (!company) return null;

  const roleCandidates = rest.filter((s) => ROLE.test(s) && !SALARY.test(s));
  const roleSegment = roleCandidates.find((s) => !isLocation(s)) ?? roleCandidates[0];
  const locations = [
    ...rest.filter((s) => s !== roleSegment && isLocation(s)),
    ...hints.filter(isLocation),
  ];
  // Put places before bare "ONSITE"/"REMOTE" so the dedupe key uses the city.
  locations.sort((a, b) => Number(PLACE.test(b)) - Number(PLACE.test(a)));

  return {
    company,
    roles: roleSegment ? splitRoles(roleSegment) : [UNKNOWN_TITLE],
    location: locations.length > 0 ? locations.join("; ") : null,
  };
}

/** One comment can advertise several roles; each becomes its own Job. */
export function parseHiringComment(comment: HnComment): Job[] {
  if (!comment.text) return [];

  const description = htmlToText(comment.text);
  const firstLine = description.split("\n")[0] ?? "";
  const header = parseHeader(firstLine);
  if (!header) return [];

  const multiple = header.roles.length > 1;
  return header.roles.map((title, i) => ({
    source: "HN_HIRING",
    externalId: multiple ? `${comment.id}#${i}` : String(comment.id),
    url: `https://news.ycombinator.com/item?id=${comment.id}`,
    applyUrl: pickApplyUrl(description),
    title,
    companyName: header.company,
    location: header.location,
    // Only the header: bodies often mention "remote" in passing.
    workplaceType: inferWorkplaceType(firstLine),
    description,
    descriptionTruncated: false,
    salary: null,
    postedAt: new Date(comment.created_at),
    raw: comment,
  }));
}
