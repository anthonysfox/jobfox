import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHttpClient, HttpError, redactUrl } from "./http.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** Fake clock: sleep advances time instantly and records each wait. */
function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => time,
    sleep: (ms: number) => {
      sleeps.push(ms);
      time += ms;
      return Promise.resolve();
    },
  };
}

const okSchema = z.object({ ok: z.boolean() });

describe("createHttpClient", () => {
  it("parses and validates JSON", async () => {
    const http = createHttpClient({ fetch: () => Promise.resolve(jsonResponse({ ok: true })) });
    await expect(http.getJson("https://example.com/a", okSchema)).resolves.toEqual({ ok: true });
  });

  it("spaces out requests to the same host", async () => {
    const clock = fakeClock();
    const http = createHttpClient({
      ...clock,
      minIntervalMs: 1000,
      fetch: () => Promise.resolve(jsonResponse({ ok: true })),
    });

    await Promise.all([
      http.getJson("https://a.example.com/1", okSchema),
      http.getJson("https://a.example.com/2", okSchema),
      http.getJson("https://b.example.com/1", okSchema),
    ]);

    // Second request to a.example.com waits; b.example.com does not.
    expect(clock.sleeps).toEqual([1000]);
  });

  it("uses per-host intervals", async () => {
    const clock = fakeClock();
    const http = createHttpClient({
      ...clock,
      hostIntervalsMs: { "api.adzuna.com": 2500 },
      fetch: () => Promise.resolve(jsonResponse({ ok: true })),
    });

    await http.getJson("https://api.adzuna.com/1", okSchema);
    await http.getJson("https://api.adzuna.com/2", okSchema);

    expect(clock.sleeps).toEqual([2500]);
  });

  it("retries 503s and honors Retry-After", async () => {
    const clock = fakeClock();
    const responses = [
      jsonResponse({}, { status: 503, headers: { "retry-after": "7" } }),
      jsonResponse({ ok: true }),
    ];
    const http = createHttpClient({
      ...clock,
      minIntervalMs: 0,
      fetch: () => Promise.resolve(responses.shift() ?? jsonResponse({}, { status: 500 })),
    });

    await expect(http.getJson("https://example.com", okSchema)).resolves.toEqual({ ok: true });
    expect(clock.sleeps).toEqual([7000]);
  });

  it("does not retry other 4xx errors", async () => {
    let calls = 0;
    const http = createHttpClient({
      minIntervalMs: 0,
      fetch: () => {
        calls++;
        return Promise.resolve(jsonResponse({}, { status: 404 }));
      },
    });

    await expect(http.getJson("https://example.com", okSchema)).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts", async () => {
    let calls = 0;
    const http = createHttpClient({
      ...fakeClock(),
      minIntervalMs: 0,
      maxAttempts: 3,
      fetch: () => {
        calls++;
        return Promise.resolve(jsonResponse({}, { status: 500 }));
      },
    });

    await expect(http.getJson("https://example.com", okSchema)).rejects.toThrow("HTTP 500");
    expect(calls).toBe(3);
  });

  it("never puts credentials in error messages", async () => {
    const http = createHttpClient({
      minIntervalMs: 0,
      fetch: () => Promise.resolve(jsonResponse({}, { status: 401 })),
    });

    const error = await http
      .getJson("https://api.adzuna.com/x?app_id=abc&app_key=secret", okSchema)
      .catch((e: unknown) => e);

    expect(String(error)).not.toContain("secret");
    expect(String(error)).not.toContain("abc");
  });

  it("reports schema mismatches with the redacted URL", async () => {
    const http = createHttpClient({
      fetch: () => Promise.resolve(jsonResponse({ ok: "yes" })),
    });

    await expect(http.getJson("https://example.com/?app_key=secret", okSchema)).rejects.toThrow(
      /Unexpected response shape from https:\/\/example\.com\/\?app_key=REDACTED/,
    );
  });
});

describe("redactUrl", () => {
  it("leaves non-secret params alone", () => {
    expect(redactUrl("https://x.com/?what=react&app_key=k")).toBe(
      "https://x.com/?what=react&app_key=REDACTED",
    );
  });
});
