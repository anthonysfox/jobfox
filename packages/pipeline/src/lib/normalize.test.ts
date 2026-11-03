import { describe, expect, it } from "vitest";
import {
  containsPhrase,
  dedupeKey,
  inferEmploymentType,
  inferWorkplaceType,
  normalizeCompany,
  normalizeLocation,
  normalizeTitle,
} from "./normalize.ts";

describe("normalizeCompany", () => {
  it.each([
    ["Acme, Inc.", "acme"],
    ["Acme Inc", "acme"],
    ["ACME LLC", "acme"],
    ["The Trade Desk", "trade desk"],
    ["Procter & Gamble Co.", "procter and gamble"],
    ["Nestlé", "nestle"],
    ["Ramp (YC W19)", "ramp"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeCompany(input)).toBe(expected);
  });

  it("keeps a name that is only a suffix word", () => {
    expect(normalizeCompany("Co")).toBe("co");
  });
});

describe("normalizeTitle", () => {
  it.each([
    ["Full-Stack Engineer", "full stack engineer"],
    ["Fullstack Engineer", "full stack engineer"],
    ["Sr. Front End Developer", "senior frontend developer"],
    ["Software Engineer (Remote)", "software engineer"],
    ["Software Engineer - Remote", "software engineer"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it("keeps level markers distinct", () => {
    expect(normalizeTitle("Software Engineer II")).not.toBe(
      normalizeTitle("Software Engineer III"),
    );
  });

  it("keeps team names distinct", () => {
    expect(normalizeTitle("Software Engineer, Payments")).not.toBe(
      normalizeTitle("Software Engineer, Growth"),
    );
  });
});

describe("normalizeLocation", () => {
  it.each([
    ["New York, NY", "new york"],
    ["New York City, New York", "new york"],
    ["NYC (Hybrid)", "new york"],
    ["Manhattan, New York County", "new york"],
    ["Jersey City, NJ", "jersey city"],
    ["Remote - US", "remote"],
    ["Remote (US only)", "remote"],
    ["NYC or Remote", "new york"],
    ["United States", "us"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeLocation(input)).toBe(expected);
  });

  it("handles missing locations", () => {
    expect(normalizeLocation(null)).toBe("");
  });
});

describe("containsPhrase", () => {
  it("matches whole words regardless of punctuation and case", () => {
    expect(containsPhrase("Senior Full-Stack Engineer", "full stack")).toBe(true);
    expect(containsPhrase("Staff Engineer", "staff")).toBe(true);
  });

  it("does not match inside words", () => {
    expect(containsPhrase("Staffing Coordinator", "staff")).toBe(false);
  });

  it("never matches an empty phrase", () => {
    expect(containsPhrase("anything", " ")).toBe(false);
  });
});

describe("inferWorkplaceType", () => {
  it.each([
    [["NYC (Hybrid, 3 days)"], "HYBRID"],
    [["Remote (US)"], "REMOTE"],
    [["New York", "This role is on-site"], "ONSITE"],
    [["New York", null], "UNKNOWN"],
  ] as const)("%j -> %s", (texts, expected) => {
    expect(inferWorkplaceType(...texts)).toBe(expected);
  });
});

describe("inferEmploymentType", () => {
  const title = "Frontend Engineer";

  it.each([
    ["Contract", "CONTRACT"],
    ["Contractor", "CONTRACT"],
    ["Temporary", "CONTRACT"],
    ["FullTime", "PERMANENT"],
    ["Full-time", "PERMANENT"],
    ["part_time", "PERMANENT"],
    ["permanent", "PERMANENT"],
    ["Intern", "UNKNOWN"],
  ] as const)("label %s -> %s", (label, expected) => {
    expect(inferEmploymentType({ label, title })).toBe(expected);
  });

  it.each([
    ["React Developer (Contract)", "CONTRACT"],
    ["Full Stack Engineer - Contract-to-Hire", "CONTRACT"],
    ["Freelance Creative Developer", "CONTRACT"],
    ["Contracts Engineer", "UNKNOWN"],
    ["Full Stack Engineer", "UNKNOWN"],
  ] as const)("title %s -> %s", (jobTitle, expected) => {
    expect(inferEmploymentType({ title: jobTitle })).toBe(expected);
  });

  it.each([
    ["This is a 6-month contract with possible extension.", "CONTRACT"],
    ["This is a contract role based in NYC.", "CONTRACT"],
    ["You'll join us as a contractor.", "CONTRACT"],
    ["W2 or C2C accepted.", "CONTRACT"],
    ["Hired on a contract basis.", "CONTRACT"],
    ["We build smart contracts for DeFi.", "UNKNOWN"],
    ["Experience with government contracts is a plus.", "UNKNOWN"],
    ["This is a full-time role.", "UNKNOWN"],
  ] as const)("description %j -> %s", (description, expected) => {
    expect(inferEmploymentType({ title, description })).toBe(expected);
  });

  it("trusts a permanent label over a contract mention in the text", () => {
    expect(
      inferEmploymentType({ label: "Full-time", title, description: "Contract-to-hire." }),
    ).toBe("PERMANENT");
  });
});

describe("dedupeKey", () => {
  it("matches the same job reported differently by two sources", () => {
    const adzuna = {
      companyName: "Acme Inc.",
      title: "Full Stack Engineer",
      location: "New York, NY",
    };
    const hn = { companyName: "Acme", title: "Full-Stack Engineer (Hybrid)", location: "NYC" };
    expect(dedupeKey(adzuna)).toBe(dedupeKey(hn));
  });

  it("separates the same title at different companies", () => {
    const a = { companyName: "Acme", title: "Frontend Engineer", location: "NYC" };
    const b = { companyName: "Globex", title: "Frontend Engineer", location: "NYC" };
    expect(dedupeKey(a)).not.toBe(dedupeKey(b));
  });
});
