import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { DayCount } from "./types.ts";

export const HEAT_COLORS = [
  "#1b1f26",
  "#0e3d28",
  "#176644",
  "#249b67",
  "#44d492",
  "#b8ffcf",
] as const;

export function heatColor(level: number): string {
  return HEAT_COLORS[Math.max(0, Math.min(5, level))] ?? HEAT_COLORS[0];
}

export type HeatmapWeek = Array<DayCount | null>;

export type HeatmapGrid = {
  weeks: HeatmapWeek[];
  monthLabels: Array<{ index: number; label: string; monthKey?: string }>;
};

export function heatmapGrid(days: DayCount[]): HeatmapGrid {
  if (days.length === 0) return { weeks: [], monthLabels: [] };
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = parseISO(days[0]!.date);
  const last = parseISO(days[days.length - 1]!.date);
  let cursor = startOfWeek(first, { weekStartsOn: 0 });
  const weeks: HeatmapWeek = [] as unknown as HeatmapWeek;
  const weekColumns: HeatmapWeek[] = [];
  const rawLabels: Array<{
    index: number;
    baseLabel: string;
    shortYearLabel: string;
    monthKey: string;
  }> = [];
  let lastMonthKey = "";

  while (cursor <= last) {
    const week: HeatmapWeek = [];
    for (let i = 0; i < 7; i += 1) {
      const key = format(cursor, "yyyy-MM-dd");
      week.push(byDate.get(key) ?? null);
      cursor = addDays(cursor, 1);
    }
    // Prefer the first day in this week that begins a new month (day "01"), otherwise first non-null day
    const firstOfNewMonth = week.find((d) => d && d.date.slice(8, 10) === "01");
    const labelDay = (firstOfNewMonth ?? week.find((d) => d))?.date;
    if (labelDay) {
      const monthKey = labelDay.slice(0, 7);
      if (monthKey !== lastMonthKey) {
        if (
          rawLabels.length === 1 &&
          weekColumns.length - rawLabels[0]!.index < 2
        ) {
          rawLabels.shift();
        }
        const parsed = parseISO(labelDay);
        const baseLabel = format(parsed, "MMM");
        const yy = labelDay.slice(2, 4);
        rawLabels.push({
          index: weekColumns.length,
          baseLabel,
          shortYearLabel: `${baseLabel} '${yy}`,
          monthKey,
        });
        lastMonthKey = monthKey;
      }
    }
    weekColumns.push(week);
  }

  void weeks;
  const counts = new Map<string, number>();
  for (const item of rawLabels) {
    counts.set(item.baseLabel, (counts.get(item.baseLabel) ?? 0) + 1);
  }

  const monthLabels = rawLabels.map((item) => ({
    index: item.index,
    label:
      (counts.get(item.baseLabel) ?? 0) > 1
        ? item.shortYearLabel
        : item.baseLabel,
    monthKey: item.monthKey,
  }));

  return { weeks: weekColumns, monthLabels };
}

export function shiftDate(
  days: DayCount[],
  selected: string,
  delta: number,
): string {
  if (days.length === 0) return selected;
  const index = days.findIndex((d) => d.date === selected);
  const fallback = delta < 0 ? 0 : days.length - 1;
  const from = index === -1 ? fallback : index;
  const next = days[from + delta];
  return next?.date ?? days[from]?.date ?? selected;
}

export function compactCount(n: number): string {
  if (n >= 999_500) {
    const value = n / 1_000_000;
    if (value >= 10 || Number.isInteger(value)) return `${value.toFixed(0)}m`;
    return `${value.toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (n >= 1000) {
    const value = n / 1000;
    if (n >= 10_000 || Number.isInteger(value)) return `${value.toFixed(0)}k`;
    return `${value.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

/**
 * Computes round ("nice") Y-axis ticks (e.g. [0, 500, 1000, 1500, 2000]) for any chart maximum.
 */
export function niceAxisTicks(maxValue: number): {
  max: number;
  ticks: number[];
} {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { max: 10, ticks: [0, 5, 10] };
  }
  if (maxValue <= 4) {
    const top = Math.max(2, Math.ceil(maxValue));
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += 1) ticks.push(v);
    return { max: top, ticks };
  }

  const rawStep = maxValue / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);

  let step = candidates[candidates.length - 1]!;
  for (const c of candidates) {
    if (c < 1) continue;
    if (Number.isInteger(c) && Math.ceil(maxValue / c) <= 4) {
      step = c;
      break;
    }
  }
  step = Math.max(1, Math.round(step));
  const steps = Math.max(2, Math.ceil(maxValue / step));
  const niceMax = steps * step;
  const ticks: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    ticks.push(i * step);
  }
  return { max: niceMax, ticks };
}

export function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&" + "amp;",
    "<": "&" + "lt;",
    ">": "&" + "gt;",
    '"': "&" + "quot;",
    "'": "&" + "apos;",
  };
  return value.replace(/[&<>"']/g, (ch) => entities[ch] ?? ch);
}
