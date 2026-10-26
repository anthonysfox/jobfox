import { describe, expect, it } from "vitest";
import type { FilterConfig } from "../core/config.js";
import { UNKNOWN_TITLE } from "../core/job.js";
import { rejectReasons } from "./filters.js";

const filters: FilterConfig = {
  titleKeywords: ["full stack", "frontend", "software engineer", "solutions engineer"],
  locations: ["new york", "nyc", "jersey city", "hoboken"],
  remoteOk: true,
  remoteExcludedRegions: ["europe", "emea", "uk", "canada"],
  seniorityExclude: ["staff", "principal", "director"],
  companyBlocklist: ["Globex Corporation"],
};

const base = {
  companyName: "Acme",
  title: "Full Stack Engineer",
  location: "New York, NY",
  workplaceType: "HYBRID" as const,
};

describe("rejectReasons", () => {
  it("passes a matching job", () => {
    expect(rejectReasons(base, filters)).toEqual([]);
  });

  it("matches title keywords across spelling variants", () => {
    expect(rejectReasons({ ...base, title: "Fullstack Developer" }, filters)).toEqual([]);
    expect(rejectReasons({ ...base, title: "Front-End Engineer" }, filters)).toEqual([]);
  });

  it("rejects titles without a keyword", () => {
    expect(rejectReasons({ ...base, title: "Account Executive" }, filters)).toEqual([
      "title:no-keyword-match",
    ]);
  });

  it("rejects excluded seniority", () => {
    expect(rejectReasons({ ...base, title: "Staff Software Engineer" }, filters)).toEqual([
      "seniority:staff",
    ]);
  });

  it("does not treat 'Staffing' as 'Staff'", () => {
    expect(
      rejectReasons({ ...base, title: "Software Engineer, Staffing Platform" }, filters),
    ).toEqual([]);
  });

  it("matches the blocklist after normalizing company names", () => {
    expect(rejectReasons({ ...base, companyName: "Globex Corp." }, filters)).toEqual([
      "company:blocklisted",
    ]);
  });

  it("rejects on-site jobs elsewhere", () => {
    expect(
      rejectReasons({ ...base, location: "Austin, TX", workplaceType: "ONSITE" }, filters),
    ).toEqual(["location:not-allowed"]);
  });

  it("accepts NJ cities from the config", () => {
    expect(rejectReasons({ ...base, location: "Jersey City, NJ" }, filters)).toEqual([]);
  });

  it("accepts US remote jobs", () => {
    expect(
      rejectReasons({ ...base, location: "Remote (US)", workplaceType: "REMOTE" }, filters),
    ).toEqual([]);
  });

  it("accepts a remote job whose location field is a city", () => {
    expect(
      rejectReasons({ ...base, location: "San Francisco, CA", workplaceType: "REMOTE" }, filters),
    ).toEqual([]);
  });

  it("rejects remote jobs limited to excluded regions", () => {
    expect(
      rejectReasons({ ...base, location: "Remote - Europe", workplaceType: "REMOTE" }, filters),
    ).toEqual(["remote:region:europe"]);
    expect(
      rejectReasons(
        { ...base, title: "Frontend Engineer (EMEA)", location: "Remote", workplaceType: "REMOTE" },
        filters,
      ),
    ).toEqual(["remote:region:emea"]);
  });

  it("rejects remote jobs when remote is off", () => {
    expect(
      rejectReasons(
        { ...base, location: "Remote", workplaceType: "REMOTE" },
        { ...filters, remoteOk: false },
      ),
    ).toEqual(["remote:not-allowed"]);
  });

  it("keeps jobs with an unknown location", () => {
    expect(rejectReasons({ ...base, location: null, workplaceType: "UNKNOWN" }, filters)).toEqual(
      [],
    );
  });

  it("keeps jobs with an unknown title", () => {
    expect(rejectReasons({ ...base, title: UNKNOWN_TITLE }, filters)).toEqual([]);
  });

  it("collects every reason", () => {
    expect(
      rejectReasons(
        {
          companyName: "Globex",
          title: "Principal Engineer",
          location: "Austin, TX",
          workplaceType: "ONSITE",
        },
        filters,
      ),
    ).toEqual([
      "company:blocklisted",
      "seniority:principal",
      "title:no-keyword-match",
      "location:not-allowed",
    ]);
  });
});
