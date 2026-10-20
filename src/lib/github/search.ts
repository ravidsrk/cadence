import { isValidIsoDate, normalizeUsername } from "./username.ts";

export type CadenceSearch = {
  d?: string;
  range?: number;
  y?: number;
  view?: "2d" | "3d";
  skeleton?: number;
};

export type CompareHomeSearch = {
  a?: string;
};

export type ComparePairSearch = {
  y?: number;
};

export function validateCadenceSearch(
  search: Record<string, unknown> | undefined | null,
): CadenceSearch {
  const src = search ?? {};
  const rawDate = typeof src.d === "string" ? src.d : typeof src.day === "string" ? src.day : undefined;
  const d = rawDate && isValidIsoDate(rawDate) ? rawDate : undefined;
  const view =
    src.view === "3d" ? "3d" : src.view === "2d" ? "2d" : undefined;
  const range = parseYear(src.range ?? src.y);
  const skeleton =
    src.skeleton === 1 || src.skeleton === "1" ? 1 : undefined;
  return {
    ...(d ? { d } : {}),
    ...(range ? { range } : {}),
    ...(view ? { view } : {}),
    ...(skeleton ? { skeleton } : {}),
  };
}

export function validateCompareHomeSearch(
  search: Record<string, unknown> | undefined | null,
): CompareHomeSearch {
  const src = search ?? {};
  const raw = typeof src.a === "string" ? src.a.trim() : "";
  const a = raw ? normalizeUsername(raw) : null;
  return { a: a ?? undefined };
}

export function validateComparePairSearch(
  search: Record<string, unknown> | undefined | null,
): ComparePairSearch {
  return { y: parseYear((search ?? {}).y) };
}

export function cadenceSearchFromState(input: {
  today: string;
  selectedDate: string;
  year?: number;
  view?: "2d" | "3d";
}): CadenceSearch {
  const defaultDate =
    input.year && input.year < Number(input.today.slice(0, 4))
      ? `${input.year}-12-31`
      : input.today;
  return {
    ...(input.selectedDate !== defaultDate ? { d: input.selectedDate } : {}),
    ...(input.year ? { range: input.year } : {}),
    ...(input.view === "3d" ? { view: "3d" as const } : {}),
  };
}

function parseYear(raw: unknown): number | undefined {
  const yRaw =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  const maxYear = Math.max(2026, new Date().getUTCFullYear());
  return Number.isInteger(yRaw) && yRaw >= 2008 && yRaw <= maxYear ? yRaw : undefined;
}
