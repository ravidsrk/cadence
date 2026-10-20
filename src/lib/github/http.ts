import type { GithubFnError } from "./types";

export function apiErrorStatus(code: GithubFnError["code"]): number {
  if (code === "not_found") return 404;
  if (code === "organization") return 422;
  if (code === "rate_limit") return 429;
  return 503;
}

export function svgResponse(body: string, cacheSeconds = 300, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        status >= 400 || cacheSeconds <= 0
          ? "no-store"
          : `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds = 180) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control":
        status >= 400 || cacheSeconds <= 0
          ? "no-store"
          : `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function parseYearParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const year = Number(raw);
  const maxYear = Math.max(2026, new Date().getUTCFullYear());
  if (!Number.isInteger(year) || year < 2008 || year > maxYear) return undefined;
  return year;
}
