import type { CalendarStats, DayCount } from "./types";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function assignLevels(days: DayCount[]): DayCount[] {
  const nonzero = days.map((d) => d.count).filter((n) => n > 0);
  if (nonzero.length === 0) {
    return days.map((d) => ({ ...d, level: 0 }));
  }
  const sorted = [...nonzero].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const q1 = q(0.25);
  const q2 = q(0.5);
  const q3 = q(0.75);
  return days.map((d) => {
    if (d.count <= 0) return { ...d, level: 0 };
    if (d.count >= q3) return { ...d, level: 4 };
    if (d.count >= q2) return { ...d, level: 3 };
    if (d.count >= q1) return { ...d, level: 2 };
    return { ...d, level: 1 };
  });
}

export function computeStats(days: DayCount[], today: string): CalendarStats {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const todayCount = byDate.get(today) ?? 0;

  const weekStart = addDays(today, -6);
  let week = 0;
  for (const d of days) {
    if (d.date >= weekStart && d.date <= today) week += d.count;
  }

  let longestStreak = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  let cursor = today;
  if ((byDate.get(cursor) ?? 0) === 0) {
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
    bestDay,
    activeDays,
  };
}
