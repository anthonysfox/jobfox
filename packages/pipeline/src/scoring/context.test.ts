import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readPreferences } from "./context.ts";

describe("readPreferences", () => {
  it("uses the private file when it exists", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "jobfox-")), "preferences.md");
    writeFileSync(file, "Remote only.\n");
    expect(readPreferences("Example.", file)).toBe("Remote only.\n");
  });

  it("falls back to the config's example", () => {
    expect(readPreferences("Example.", "does/not/exist.md")).toBe("Example.");
  });
});
