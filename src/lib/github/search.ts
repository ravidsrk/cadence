import { USERNAME_PATTERN } from "./username";

export type CadenceSearch = {
  d?: string;
  y?: number;
};

export type CompareHomeSearch = {
  a?: string;
};

export type ComparePairSearch = {
  y?: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCadenceSearch(
  search: Record<string, unknown> | undefined | null,
): CadenceSearch {
  const src = search ?? {};
  const d =
    typeof src.d === "string" && DATE_RE.test(src.d) ? src.d : undefined;
  return { d, y: parseYear(src.y) };
}

export function validateCompareHomeSearch(
  search: Record<string, unknown> | undefined | null,
): CompareHomeSearch {
  const src = search ?? {};
  const a = typeof src.a === "string" ? src.a.trim() : "";
  return { a: USERNAME_PATTERN.test(a) ? a : undefined };
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
}): CadenceSearch {
  return {
    d: input.selectedDate !== input.today ? input.selectedDate : undefined,
    y: input.year,
  };
}

function parseYear(raw: unknown): number | undefined {
  const yRaw =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(yRaw) && yRaw >= 2008 && yRaw <= 2100 ? yRaw : undefined;
}
