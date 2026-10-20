import type { CalendarStats, DayCount } from "./types.ts";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const INTENSITY_THRESHOLDS = [
  { level: 0 as const, label: "Rest", rangeLabel: "0", min: 0, max: 0 },
  { level: 1 as const, label: "Light", rangeLabel: "1–9", min: 1, max: 9 },
  { level: 2 as const, label: "Steady", rangeLabel: "10–49", min: 10, max: 49 },
  { level: 3 as const, label: "High", rangeLabel: "50–199", min: 50, max: 199 },
  {
    level: 4 as const,
    label: "Very high",
    rangeLabel: "200–499",
    min: 200,
    max: 499,
  },
  {
    level: 5 as const,
    label: "Peak",
    rangeLabel: "500+",
    min: 500,
    max: Infinity,
  },
] as const;

export function intensityLevelForCount(count: number): IntensityLevel {
  if (count <= 0) return 0;
  if (count <= 9) return 1;
  if (count <= 49) return 2;
  if (count <= 199) return 3;
  if (count <= 499) return 4;
  return 5;
}

export function intensityBracketForCount(count: number) {
  const lvl = intensityLevelForCount(count);
  return INTENSITY_THRESHOLDS[lvl];
}

export type IntensityBucketSummary = {
  level: IntensityLevel;
  label: string;
  rangeLabel: string;
  count: number;
  pct: number;
};

export function bucketIntensityCounts(days: DayCount[]): IntensityBucketSummary[] {
  const total = Math.max(1, days.length);
  const counts: [number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0,
  ];
  for (const d of days) {
    const lvl = intensityLevelForCount(d.count);
    counts[lvl] += 1;
  }
  return INTENSITY_THRESHOLDS.map((t) => ({
    level: t.level,
    label: t.label,
    rangeLabel: t.rangeLabel,
    count: counts[t.level],
    pct: days.length > 0 ? Math.round((counts[t.level] / total) * 100) : 0,
  }));
}

export function assignLevels(
  days: Array<Pick<DayCount, "date" | "count">>,
): DayCount[] {
  return days.map((d) => ({
    date: d.date,
    count: d.count,
    level: intensityLevelForCount(d.count),
  }));
}

export function longestStreakWindow(
  days: DayCount[],
): { start: string; end: string; days: number } | null {
  let bestLen = 0;
  let bestStart = "";
  let bestEnd = "";
  let runLen = 0;
  let runStart = "";

  for (const d of days) {
    if (d.count > 0) {
      if (runLen === 0) runStart = d.date;
      runLen += 1;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
        bestEnd = d.date;
      }
    } else {
      runLen = 0;
      runStart = "";
    }
  }

  if (bestLen === 0) return null;
  return { start: bestStart, end: bestEnd, days: bestLen };
}

/** Contributions in the seven calendar days ending on the given date. */
export function weekTotal(days: DayCount[], endingDate: string): number {
  const start = addDays(endingDate, -6);
  return days.reduce(
    (sum, day) =>
      day.date >= start && day.date <= endingDate ? sum + day.count : sum,
    0,
  );
}

export function computeStats(
  days: DayCount[],
  today: string,
  allowYesterdayFallback = true,
): CalendarStats {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const todayCount = byDate.get(today) ?? 0;

  const week = weekTotal(days, today);

  const longestWin = longestStreakWindow(days);
  const longestStreak = longestWin?.days ?? 0;
  const longestStreakRange = longestWin
    ? { start: longestWin.start, end: longestWin.end }
    : null;

  let currentStreak = 0;
  let cursor = today;
  if (allowYesterdayFallback && (byDate.get(cursor) ?? 0) === 0) {
    cursor = addDays(cursor, -1);
  }
  while (true) {
    const count = byDate.get(cursor);
    if (count == null) break;
    if (count <= 0) break;
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let bestDay: CalendarStats["bestDay"] = null;
  for (const d of days) {
    if (!bestDay || d.count > bestDay.count) {
      bestDay = { date: d.date, count: d.count };
    }
  }
  if (bestDay && bestDay.count === 0) bestDay = null;

  const activeDays = days.filter((d) => d.count > 0).length;

  return {
    total,
    today: todayCount,
    week,
    currentStreak,
    longestStreak,
    longestStreakRange,
    bestDay,
    activeDays,
  };
}
