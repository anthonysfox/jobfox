import { z } from "zod";

export interface HttpClient {
  /** GET a JSON endpoint and validate the body. Throws HttpError or a validation error. */
  getJson<T>(url: string | URL, schema: z.ZodType<T>): Promise<T>;
  /** Follow ordinary HTTP redirects and return the final URL. */
  resolveRedirects(url: string | URL): Promise<string>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export interface HttpClientOptions {
  /** Minimum gap between requests to the same host, in ms. */
  minIntervalMs?: number;
  /** Per-host overrides, e.g. { "api.adzuna.com": 2500 }. */
  hostIntervalsMs?: Record<string, number>;
  timeoutMs?: number;
  maxAttempts?: number;
  userAgent?: string;
  // Injected for tests.
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const SECRET_PARAMS = ["app_key", "app_id", "api_key", "key", "token"];

/** Strip credentials from a URL before it ends up in an error message or log. */
export function redactUrl(url: string | URL): string {
  const u = new URL(url);
  for (const param of SECRET_PARAMS) {
    if (u.searchParams.has(param)) u.searchParams.set(param, "REDACTED");
  }
  return u.toString();
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryAfterMs(res: Response): number | null {
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const {
    minIntervalMs = 1000,
    hostIntervalsMs = {},
    timeoutMs = 15_000,
    maxAttempts = 3,
    userAgent = "jobfox/1.0 (personal job-search tool)",
    fetch: fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = options;

  // Each request reserves the next free slot for its host synchronously, so
  // concurrent callers queue up instead of all firing at once.
  const nextSlot = new Map<string, number>();

  async function waitForSlot(host: string): Promise<void> {
    const interval = hostIntervalsMs[host] ?? minIntervalMs;
    const current = now();
    const slot = Math.max(current, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + interval);
    if (slot > current) await sleep(slot - current);
  }

  async function request(
    url: URL,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
  ): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      await waitForSlot(url.host);
      let res: Response;
      try {
        res = await fetchImpl(url, {
          ...init,
          headers: { "user-agent": userAgent, ...init.headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (res.ok) return res;
      if (!isRetryable(res.status) || attempt >= maxAttempts) {
        await res.body?.cancel();
        throw new HttpError(res.status, redactUrl(url));
      }
      await res.body?.cancel();
      await sleep(retryAfterMs(res) ?? 500 * 2 ** attempt);
    }
  }

  return {
    async getJson(input, schema) {
      const url = new URL(input);
      const res = await request(url, { method: "GET", headers: { accept: "application/json" } });
      const body: unknown = await res.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        throw new Error(
          `Unexpected response shape from ${redactUrl(url)}:\n${z.prettifyError(result.error)}`,
        );
      }
      return result.data;
    },

    async resolveRedirects(input) {
      const url = new URL(input);
      const res = await request(url, { method: "GET", redirect: "follow" });
      await res.body?.cancel();
      return res.url || url.toString();
    },
  };
}
