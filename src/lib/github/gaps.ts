import { format, parseISO } from "date-fns";
import type { DayCount } from "./types";

export type GapRun = {
  start: string;
  end: string;
  days: number;
};

export type MonthRollup = {
  key: string;
  label: string;
  total: number;
  active: number;
  days: number;
};

export type QuietStats = {
  longestGap: GapRun | null;
  currentPause: number;
  quietestMonth: MonthRollup | null;
  busiestMonth: MonthRollup | null;
};

export function monthRollup(days: DayCount[]): MonthRollup[] {
  const map = new Map<string, MonthRollup>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: format(parseISO(`${key}-01`), "MMM yyyy"),
        total: 0,
        active: 0,
        days: 0,
      };
      map.set(key, row);
    }
    row.days += 1;
    row.total += day.count;
    if (day.count > 0) row.active += 1;
  }
  return [...map.values()];
}

export function quietStats(days: DayCount[], today: string): QuietStats {
  let longestGap: GapRun | null = null;
  let runStart: string | null = null;
  let runLen = 0;

  const closeRun = (end: string) => {
    if (!runStart || runLen === 0) return;
    if (!longestGap || runLen > longestGap.days) {
      longestGap = { start: runStart, end, days: runLen };
    }
  };

  for (let i = 0; i < days.length; i += 1) {
    const day = days[i]!;
    if (day.count <= 0) {
      if (!runStart) runStart = day.date;
      runLen += 1;
    } else {
      if (runStart) closeRun(days[i - 1]?.date ?? day.date);
      runStart = null;
      runLen = 0;
    }
  }
  if (runStart && runLen > 0) {
    closeRun(days[days.length - 1]!.date);
  }

  const byDate = new Map(days.map((d) => [d.date, d.count]));
  let currentPause = 0;
  if ((byDate.get(today) ?? 0) === 0) {
    const index = days.findIndex((d) => d.date === today);
    for (let i = index === -1 ? days.length - 1 : index; i >= 0; i -= 1) {
      const day = days[i];
      if (!day || day.count > 0) break;
      currentPause += 1;
    }
  }

  const months = monthRollup(days);
  let quietestMonth: MonthRollup | null = null;
  let busiestMonth: MonthRollup | null = null;
  for (const month of months) {
    if (month.days < 14) continue;
    if (!quietestMonth || month.active < quietestMonth.active) {
      quietestMonth = month;
    }
    if (!busiestMonth || month.total > busiestMonth.total) {
      busiestMonth = month;
    }
  }

  return { longestGap, currentPause, quietestMonth, busiestMonth };
}
