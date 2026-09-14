export function svgResponse(body: string, cacheSeconds = 300) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds = 180) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function parseYearParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2008 || year > 2100) return undefined;
  return year;
}
