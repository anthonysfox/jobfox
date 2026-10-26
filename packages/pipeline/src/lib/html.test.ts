import { describe, expect, it } from "vitest";
import { decodeEntities, extractUrls, htmlToText } from "./html.js";

describe("decodeEntities", () => {
  it("decodes named, decimal, and hex entities", () => {
    expect(decodeEntities("R&amp;D &#39;team&#x27; &#x2F; &quot;x&quot;")).toBe(`R&D 'team' / "x"`);
  });

  it("does not double-decode", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("htmlToText", () => {
  it("converts HN-style comment HTML", () => {
    const html =
      'Acme | Full Stack Engineer | NYC<p>We build things.<p>Apply: <a href="https:&#x2F;&#x2F;jobs.lever.co&#x2F;acme" rel="nofollow">https:&#x2F;&#x2F;jobs.lever.co&#x2F;acme</a>';

    expect(htmlToText(html)).toBe(
      "Acme | Full Stack Engineer | NYC\n\nWe build things.\n\nApply: https://jobs.lever.co/acme",
    );
  });

  it("keeps the target of a link with a text label", () => {
    expect(htmlToText('<a href="https://acme.com/jobs">our careers page</a>')).toBe(
      "our careers page (https://acme.com/jobs)",
    );
  });

  it("strips other tags", () => {
    expect(htmlToText("<strong>Senior</strong> <i>Engineer</i>")).toBe("Senior Engineer");
  });
});

describe("extractUrls", () => {
  it("finds URLs and trims trailing punctuation", () => {
    expect(
      extractUrls("Apply at https://acme.com/jobs. Or (https://boards.greenhouse.io/acme/jobs/1)"),
    ).toEqual(["https://acme.com/jobs", "https://boards.greenhouse.io/acme/jobs/1"]);
  });
});
