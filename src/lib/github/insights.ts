import type { DayCommit, DayCount } from "./types";
import { profilePath } from "./username.ts";

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export type WeekdayRow = {
  weekday: number;
  label: string;
  count: number;
};

export function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

export function weekdayTotals(days: DayCount[]): WeekdayRow[] {
  const rows: WeekdayRow[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    count: 0,
  }));
  for (const day of days) {
    const index = weekdayOf(day.date);
    const row = rows[index];
    if (row) row.count += day.count;
  }
  return rows;
}

const MON_SUN_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function orderWeekdaysMonFirst(rows: WeekdayRow[]): WeekdayRow[] {
  if (rows.length === 0) return [];
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  const ordered: WeekdayRow[] = [];
  for (const wd of MON_SUN_ORDER) {
    const found = byDay.get(wd);
    if (found) ordered.push(found);
  }
  return ordered.length === rows.length ? ordered : rows;
}

export function weekdayTotalsMonFirst(days: DayCount[]): WeekdayRow[] {
  return orderWeekdaysMonFirst(weekdayTotals(days));
}

export function busiestWeekday(rows: WeekdayRow[]): WeekdayRow | null {
  let best: WeekdayRow | null = null;
  for (const row of rows) {
    if (!best || row.count > best.count) best = row;
  }
  if (!best || best.count === 0) return null;
  return best;
}

export type Consistency = {
  totalDays: number;
  activeDays: number;
  activeRatio: number;
  avgOnActive: number;
  avgPerDay: number;
};

export function consistency(days: DayCount[]): Consistency {
  const totalDays = days.length;
  const activeDays = days.filter((day) => day.count > 0).length;
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return {
    totalDays,
    activeDays,
    activeRatio: totalDays ? activeDays / totalDays : 0,
    avgOnActive: activeDays ? total / activeDays : 0,
    avgPerDay: totalDays ? total / totalDays : 0,
  };
}

export function hourHistogram(isoTimes: string[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const stamp of isoTimes) {
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    hours[date.getHours()] += 1;
  }
  return hours;
}

export type RepoCount = { repo: string; count: number };

export function repoMix(commits: Array<Pick<DayCommit, "repo">>): RepoCount[] {
  const map = new Map<string, number>();
  for (const commit of commits) {
    map.set(commit.repo, (map.get(commit.repo) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo));
}

export function shareText(input: {
  login: string;
  name?: string | null;
  streak: number;
  total: number;
  rangeLabel: string;
  dayCount?: number;
  dayLabel?: string;
  mergedCount?: number;
  url: string;
}): string {
  const who = input.name?.trim() || input.login;
  const lines: string[] = [];
  if (input.dayLabel) {
    const bits: string[] = [];
    if (input.mergedCount != null) {
      bits.push(
        `${input.mergedCount} PR${input.mergedCount === 1 ? "" : "s"} merged`,
      );
    }
    if (input.dayCount != null) {
      bits.push(`${input.dayCount} commits`);
    }
    if (bits.length) {
      lines.push(`${who} · ${bits.join(" · ")} on ${input.dayLabel}`);
    }
  }
  lines.push(
    `${input.streak}-day streak · ${input.total.toLocaleString("en-IN")} contributions · ${input.rangeLabel}`,
  );
  lines.push(input.url);
  return lines.join("\n");
}

export function profilePermalink(input: {
  origin: string;
  username: string;
  today: string;
  selectedDate: string;
  year?: number;
  view?: "2d" | "3d";
}): string {
  const url = new URL(profilePath(input.username), input.origin);
  const defaultDate =
    input.year && input.year < Number(input.today.slice(0, 4))
      ? `${input.year}-12-31`
      : input.today;
  if (input.selectedDate !== defaultDate) {
    url.searchParams.set("d", input.selectedDate);
  }
  if (input.year) url.searchParams.set("range", String(input.year));
  if (input.view === "3d") url.searchParams.set("view", "3d");
  return url.toString();
}
