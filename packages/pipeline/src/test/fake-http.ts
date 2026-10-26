import type { z } from "zod";
import { HttpError, type HttpClient } from "../lib/http.ts";

/**
 * In-memory HttpClient for source tests. Routes map a URL predicate to a JSON
 * body. Real Zod schemas still run, so fixtures must match the real API shape.
 */
export interface FakeRoute {
  match: (url: URL) => boolean;
  body: unknown;
}

export interface FakeHttp extends HttpClient {
  requests: URL[];
}

export function createFakeHttp(
  routes: FakeRoute[],
  redirects: Record<string, string> = {},
): FakeHttp {
  const requests: URL[] = [];
  return {
    requests,
    getJson<T>(input: string | URL, schema: z.ZodType<T>): Promise<T> {
      const url = new URL(input);
      requests.push(url);
      const route = routes.find((r) => r.match(url));
      if (!route) return Promise.reject(new HttpError(404, url.toString()));
      return Promise.resolve(schema.parse(route.body));
    },
    resolveRedirects(input: string | URL): Promise<string> {
      const url = new URL(input).toString();
      return Promise.resolve(redirects[url] ?? url);
    },
  };
}
