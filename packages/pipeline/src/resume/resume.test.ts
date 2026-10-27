import { describe, expect, it } from "vitest";
import type { DraftBullet } from "../drafting/drafter.ts";
import { inlineRuns, renderResumePdf } from "./render.ts";
import { contactFromEnv, resumeFileName, tailorResume } from "./tailor.ts";

const resume = `# Sam Doe

Emerson, NJ · github.com/samdoe

## Technical skills
- **Languages:** PHP, Python, TypeScript
- **Cloud:** Docker, AWS (Certified Solutions Architect), Linux

## Experience

### Acme — New York, NY
- Onboarded engineers onto the Laravel services.
- Rebuilt the **camera dashboard** in React, cutting load time by 40%.
- Built a Node.js API serving 1,200 customers.

## Projects
- Built a CLI in Go.`;

const bullet = (text: string, source: string, issues: string[] = []): DraftBullet => ({
  text,
  source,
  issues,
});

const posting = "We use TypeScript and AWS. Python is a plus.";

describe("tailorResume", () => {
  it("replaces source lines and moves them to the top of their list in draft order", () => {
    const { markdown, replaced } = tailorResume({
      resume,
      posting,
      bullets: [
        bullet(
          "Shipped a Node.js API to 1,200 customers.",
          "Built a Node.js API serving 1,200 customers.",
        ),
        bullet(
          "Cut load time 40% by rebuilding the dashboard in React.",
          "Rebuilt the camera dashboard in React, cutting load time by 40%",
        ),
      ],
    });
    expect(replaced).toBe(2);
    expect(markdown).toContain(
      [
        "- Shipped a Node.js API to 1,200 customers.",
        "- Cut load time 40% by rebuilding the dashboard in React.",
        "- Onboarded engineers onto the Laravel services.",
      ].join("\n"),
    );
    expect(markdown).not.toContain("camera dashboard");
  });

  it("matches a source that quotes most of a line", () => {
    const { replaced } = tailorResume({
      resume,
      posting,
      bullets: [bullet("Rewrote it.", "Rebuilt the camera dashboard in React")],
    });
    expect(replaced).toBe(1);
  });

  it("leaves lines alone when the bullet was flagged or the source doesn't match", () => {
    const { markdown, replaced } = tailorResume({
      resume,
      posting: "",
      bullets: [
        bullet("Served 5,000 customers.", "Built a Node.js API serving 1,200 customers.", [
          "Numbers not in your resume: 5000.",
        ]),
        bullet("Led a team.", "Led a team of five."),
        bullet("Built a tool.", "Built"),
      ],
    });
    expect(replaced).toBe(0);
    expect(markdown).toBe(resume);
  });

  it("puts skills the posting mentions first, only in the skills section", () => {
    const { markdown } = tailorResume({ resume, posting, bullets: [] });
    expect(markdown).toContain("- **Languages:** Python, TypeScript, PHP");
    expect(markdown).toContain("- **Cloud:** AWS (Certified Solutions Architect), Docker, Linux");
    expect(markdown).toContain("- Built a CLI in Go.");
  });

  it("adds contact details to the line under the name", () => {
    const { markdown } = tailorResume({
      resume,
      posting,
      bullets: [],
      contact: contactFromEnv({ RESUME_EMAIL: "sam@example.com" }),
    });
    expect(markdown).toContain("Emerson, NJ · github.com/samdoe · sam@example.com");
  });
});

describe("resumeFileName", () => {
  it("builds a safe file name from the name and company", () => {
    expect(resumeFileName(resume, "Acme, Inc. (NYC)")).toBe("Sam_Doe_Resume_Acme_Inc_NYC.pdf");
  });
});

describe("renderResumePdf", () => {
  it("splits bold runs", () => {
    expect(inlineRuns("**Languages:** TypeScript, *Go*")).toEqual([
      { text: "Languages:", bold: true },
      { text: " TypeScript, Go", bold: false },
    ]);
  });

  it("produces a PDF", async () => {
    const pdf = await renderResumePdf(resume);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
