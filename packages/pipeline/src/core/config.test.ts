import { describe, expect, it } from "vitest";
import userConfig from "../../jobfox.config.ts";
import { parseConfig, parseEnv } from "./config.ts";

describe("parseConfig", () => {
  it("accepts the real jobfox.config.ts", () => {
    expect(() => parseConfig(userConfig)).not.toThrow();
  });

  it("fills defaults", () => {
    const config = parseConfig({
      adzuna: { searches: [{ what: "react developer" }] },
      filters: {},
    });

    expect(config.adzuna.country).toBe("us");
    expect(config.hn.enabled).toBe(true);
    expect(config.filters.remoteOk).toBe(true);
    expect(config.filters.companyBlocklist).toEqual([]);
  });

  it("explains what is wrong", () => {
    expect(() => parseConfig({ adzuna: { searches: [] }, filters: {} })).toThrow(
      /Invalid jobfox\.config\.ts[\s\S]*searches/,
    );
  });
});

describe("parseEnv", () => {
  it("treats empty Adzuna credentials as missing", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      ADZUNA_APP_ID: "",
      ADZUNA_APP_KEY: "",
    });

    expect(env.ADZUNA_APP_ID).toBeUndefined();
    expect(env.ADZUNA_APP_KEY).toBeUndefined();
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
