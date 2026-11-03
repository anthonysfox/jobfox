import { describe, expect, it } from "vitest";
import { makeJob } from "../test/make-job.ts";
import { canonicalize, mergeCanonical } from "./dedupe.ts";
import { pastedJob, pastedJobSchema } from "./manual.ts";

const description = `We're hiring a React developer to rebuild our booking app. ${"Details. ".repeat(30)}`;

describe("pastedJobSchema", () => {
  it("treats blank optional fields as missing", () => {
    const input = pastedJobSchema.parse({
      companyName: " Acme ",
      title: "Frontend Engineer",
      location: "",
      url: "",
      description,
    });
    expect(input).toMatchObject({ companyName: "Acme", location: undefined, url: undefined });
  });

  it("rejects a description too short to be a posting", () => {
    const result = pastedJobSchema.safeParse({
      companyName: "Acme",
      title: "x",
      description: "Hi",
    });
    expect(result.success).toBe(false);
  });
});

describe("pastedJob", () => {
  const input = pastedJobSchema.parse({
    companyName: "Acme",
    title: "React Developer",
    location: "Remote (US)",
    description,
  });

  it("uses the dedupe key as its ID, so pasting again updates the same job", () => {
    expect(pastedJob(input).externalId).toBe(pastedJob(input).externalId);
    expect(pastedJob(input)).toMatchObject({
      source: "MANUAL",
      url: "",
      applyUrl: null,
      workplaceType: "REMOTE",
    });
  });

  it("infers the employment type from the text", () => {
    const contract = pastedJobSchema.parse({
      ...input,
      description: `This is a 6-month contract. ${description}`,
    });
    expect(pastedJob(contract).employmentType).toBe("CONTRACT");
  });

  it("wins the description but keeps a discovered job's link when it has none", () => {
    const discovered = canonicalize([
      makeJob({ source: "ADZUNA", url: "https://adzuna.example/1", description: "Snippet…" }),
    ]);
    const merged = mergeCanonical(discovered, canonicalize([pastedJob(input)]));
    expect(merged.descriptionSource).toBe("MANUAL");
    expect(merged.description).toBe(input.description);
    expect(merged.applyUrl).toBe("https://adzuna.example/1");
  });
});
