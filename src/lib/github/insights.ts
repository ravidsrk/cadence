import type { DayCommit, DayCount } from "./types";

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
  url: string;
}): string {
  const who = input.name?.trim() || input.login;
  const lines: string[] = [];
  if (input.dayLabel != null && input.dayCount != null) {
    lines.push(
      `${who} · ${input.dayCount} public commits on ${input.dayLabel}`,
    );
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
}): string {
  const url = new URL(`/u/${encodeURIComponent(input.username)}`, input.origin);
  if (input.selectedDate !== input.today) {
    url.searchParams.set("d", input.selectedDate);
  }
  if (input.year) url.searchParams.set("y", String(input.year));
  return url.toString();
}
