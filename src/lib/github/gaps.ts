import { format, parseISO } from "date-fns";
import type { DayCount } from "./types.ts";

export type GapRun = {
  start: string;
  end: string;
  days: number;
};

export type MonthRollup = {
  key: string;
  label: string;
  shortLabel: string;
  shortYearLabel: string;
  total: number;
  active: number;
  days: number;
  daysInMonth: number;
  isPartial: boolean;
};

export type QuietStats = {
  longestGap: GapRun | null;
  currentPause: number;
  quietestMonth: MonthRollup | null;
  busiestMonth: MonthRollup | null;
};

export function getDaysInMonth(monthKey: string): number {
  const [yStr, mStr] = monthKey.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRollup(
  days: DayCount[],
  todayIso?: string,
): MonthRollup[] {
  const map = new Map<string, MonthRollup>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    let row = map.get(key);
    if (!row) {
      const dim = getDaysInMonth(key);
      const parsed = parseISO(`${key}-01`);
      const mmm = format(parsed, "MMM");
      const yy = key.slice(2, 4);
      row = {
        key,
        label: format(parsed, "MMM yyyy"),
        shortLabel: mmm,
        shortYearLabel: `${mmm} '${yy}`,
        total: 0,
        active: 0,
        days: 0,
        daysInMonth: dim,
        isPartial: false,
      };
      map.set(key, row);
    }
    row.days += 1;
    row.total += day.count;
    if (day.count > 0) row.active += 1;
  }

  const list = [...map.values()];
  const monthNameCounts = new Map<string, number>();
  for (const item of list) {
    const baseName = item.shortLabel;
    monthNameCounts.set(baseName, (monthNameCounts.get(baseName) ?? 0) + 1);
  }

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]!;
    if ((monthNameCounts.get(item.shortLabel) ?? 0) > 1) {
      item.shortLabel = item.shortYearLabel;
    }
    if (item.days < item.daysInMonth) {
      item.isPartial = true;
    }
    if (i === list.length - 1) {
      const lastDayIso =
        todayIso && todayIso.startsWith(item.key)
          ? todayIso
          : (days[days.length - 1]?.date ?? "");
      const lastDayNum = Number(lastDayIso.slice(8, 10));
      if (lastDayNum > 0 && lastDayNum < item.daysInMonth) {
        item.isPartial = true;
      }
    }
  }

  return list;
}

export function peakMonthRollup(
  months: MonthRollup[],
  opts: { completeOnly?: boolean } = {},
): MonthRollup | null {
  const pool = opts.completeOnly
    ? months.filter((m) => !m.isPartial)
    : months;
  let best: MonthRollup | null = null;
  for (const m of pool) {
    if (m.total <= 0) continue;
    if (!best || m.total > best.total) {
      best = m;
    }
  }
  return best;
}

export function formatPeakMonthLabel(peak: MonthRollup): string {
  return `Peak: ${peak.shortYearLabel} · ${peak.total.toLocaleString("en-IN")}${
    peak.isPartial ? " (partial)" : ""
  }`;
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

  const months = monthRollup(days, today);
  const eligibleMonths = months.some((m) => m.days >= 14)
    ? months.filter((m) => m.days >= 14)
    : months;
  let quietestMonth: MonthRollup | null = null;
  let busiestMonth: MonthRollup | null = null;
  for (const month of eligibleMonths) {
    if (!quietestMonth || month.active < quietestMonth.active) {
      quietestMonth = month;
    }
    if (!busiestMonth || month.total > busiestMonth.total) {
      busiestMonth = month;
    }
  }

  return { longestGap, currentPause, quietestMonth, busiestMonth };
}
