import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { DayCount } from "./types";

export const HEAT_COLORS = [
  "#1c1c1f",
  "#1d3d32",
  "#2f6b54",
  "#4e9a73",
  "#9ad4b1",
] as const;

export function heatColor(level: number): string {
  return HEAT_COLORS[Math.max(0, Math.min(4, level))] ?? HEAT_COLORS[0];
}

export type HeatmapWeek = Array<DayCount | null>;

export type HeatmapGrid = {
  weeks: HeatmapWeek[];
  monthLabels: Array<{ index: number; label: string }>;
};

export function heatmapGrid(days: DayCount[]): HeatmapGrid {
  if (days.length === 0) return { weeks: [], monthLabels: [] };
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = parseISO(days[0]!.date);
  const last = parseISO(days[days.length - 1]!.date);
  let cursor = startOfWeek(first, { weekStartsOn: 0 });
  const weeks: HeatmapWeek[] = [];
  const monthLabels: Array<{ index: number; label: string }> = [];
  let lastMonth = "";

  while (cursor <= last) {
    const week: HeatmapWeek = [];
    for (let i = 0; i < 7; i += 1) {
      const key = format(cursor, "yyyy-MM-dd");
      week.push(byDate.get(key) ?? null);
      cursor = addDays(cursor, 1);
    }
    const labelDay = week.find((d) => d)?.date;
    if (labelDay) {
      const month = format(parseISO(labelDay), "MMM");
      if (month !== lastMonth) {
        monthLabels.push({ index: weeks.length, label: month });
        lastMonth = month;
      }
    }
    weeks.push(week);
  }
  return { weeks, monthLabels };
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
  if (n >= 1_000_000) {
    const value = n / 1_000_000;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}m`;
  }
  if (n >= 1000) {
    const value = n / 1000;
    return `${n >= 10_000 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return String(n);
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
