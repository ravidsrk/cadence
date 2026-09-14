export type CadenceSearch = {
  d?: string;
  y?: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCadenceSearch(
  search: Record<string, unknown> | undefined | null,
): CadenceSearch {
  const src = search ?? {};
  const d =
    typeof src.d === "string" && DATE_RE.test(src.d) ? src.d : undefined;
  const yRaw =
    typeof src.y === "number"
      ? src.y
      : typeof src.y === "string"
        ? Number(src.y)
        : Number.NaN;
  const y =
    Number.isInteger(yRaw) && yRaw >= 2008 && yRaw <= 2100 ? yRaw : undefined;
  return { d, y };
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
