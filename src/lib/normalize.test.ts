import { describe, expect, it } from "vitest";
import {
  containsPhrase,
  dedupeKey,
  inferWorkplaceType,
  normalizeCompany,
  normalizeLocation,
  normalizeTitle,
} from "./normalize.js";

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
