import { consistency } from "./insights.ts";
import { isGithubFnError, type CalendarPayload, type GithubFnError, type GithubProfile } from "./types.ts";

export const BOARD_MAX = 24;
export const BOARD_SEEDS = [
  "ravidsrk",
  "torvalds",
  "gaearon",
  "yyx990803",
  "sindresorhus",
] as const;

export type BoardSort =
  | "peak"
  | "day"
  | "streak"
  | "consistency"
  | "volume"
  | "active";

export type BoardEntry = {
  username: string;
  rank: number;
  profile: GithubProfile | null;
  streak: number;
  longest: number;
  consistency: number;
  activeDays: number;
  total: number;
  bestDay: { date: string; count: number } | null;
  byDate: Record<string, number>;
  error: string | null;
};

export function boardEntryFromCalendar(
  username: string,
  calendar: CalendarPayload | GithubFnError,
): Omit<BoardEntry, "rank"> {
  if (isGithubFnError(calendar)) {
    return {
      username,
      profile: null,
      streak: 0,
      longest: 0,
      consistency: 0,
      activeDays: 0,
      total: 0,
      bestDay: null,
      byDate: {},
      error: calendar.error,
    };
  }
  const byDate: Record<string, number> = {};
  for (const day of calendar.days) {
    if (day.count > 0) byDate[day.date] = day.count;
  }
  return {
    username: calendar.profile.login,
    profile: calendar.profile,
    streak: calendar.stats.currentStreak,
    longest: calendar.stats.longestStreak,
    consistency: consistency(calendar.days).activeRatio,
    activeDays: calendar.stats.activeDays,
    total: calendar.stats.total,
    bestDay: calendar.stats.bestDay,
    byDate,
    error: null,
  };
}

function metric(
  entry: Omit<BoardEntry, "rank">,
  sort: BoardSort,
  date?: string,
): number {
  if (sort === "day" && date) return entry.byDate[date] ?? 0;
  if (sort === "peak") return entry.bestDay?.count ?? 0;
  if (sort === "consistency") return entry.consistency;
  if (sort === "volume") return entry.total;
  if (sort === "active") return entry.activeDays;
  return entry.streak;
}

export function rankBoard(
  rows: Array<{ username: string; calendar: CalendarPayload | GithubFnError }>,
  sort: BoardSort = "peak",
  date?: string,
): BoardEntry[] {
  return sortBoard(
    rows.map((row) => boardEntryFromCalendar(row.username, row.calendar)),
    sort,
    date,
  );
}

export function sortBoard(
  entries: Array<Omit<BoardEntry, "rank">>,
  sort: BoardSort = "peak",
  date?: string,
): BoardEntry[] {
  const copy = [...entries];
  const key = date ? "day" : sort === "day" ? "peak" : sort;
  copy.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    const diff = metric(b, key, date) - metric(a, key, date);
    if (diff !== 0) return diff;
    return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
  });
  return copy.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export type BoardSearch =
  | { d: string }
  | { s: Exclude<BoardSort, "peak"> }
  | Record<string, never>;

export function parseBoardSort(raw: unknown): BoardSort {
  if (
    raw === "streak" ||
    raw === "consistency" ||
    raw === "volume" ||
    raw === "active" ||
    raw === "day"
  ) {
    return raw;
  }
  return "peak";
}

export function boardSearchFromState(input: {
  sort: BoardSort;
  date?: string;
}): BoardSearch {
  if (input.date) return { d: input.date };
  if (input.sort === "peak" || input.sort === "day") return {};
  return { s: input.sort };
}
