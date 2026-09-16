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

export type BoardSort = "streak" | "consistency" | "volume" | "active";

export type BoardEntry = {
  username: string;
  rank: number;
  profile: GithubProfile | null;
  streak: number;
  longest: number;
  consistency: number;
  activeDays: number;
  total: number;
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
      error: calendar.error,
    };
  }
  return {
    username: calendar.profile.login,
    profile: calendar.profile,
    streak: calendar.stats.currentStreak,
    longest: calendar.stats.longestStreak,
    consistency: consistency(calendar.days).activeRatio,
    activeDays: calendar.stats.activeDays,
    total: calendar.stats.total,
    error: null,
  };
}

function metric(entry: Omit<BoardEntry, "rank">, sort: BoardSort): number {
  if (sort === "consistency") return entry.consistency;
  if (sort === "volume") return entry.total;
  if (sort === "active") return entry.activeDays;
  return entry.streak;
}

export function rankBoard(
  rows: Array<{ username: string; calendar: CalendarPayload | GithubFnError }>,
  sort: BoardSort = "streak",
): BoardEntry[] {
  return sortBoard(
    rows.map((row) => boardEntryFromCalendar(row.username, row.calendar)),
    sort,
  );
}

export function sortBoard(
  entries: Array<Omit<BoardEntry, "rank">>,
  sort: BoardSort = "streak",
): BoardEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    const diff = metric(b, sort) - metric(a, sort);
    if (diff !== 0) return diff;
    return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
  });
  return copy.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function parseBoardSort(raw: unknown): BoardSort {
  return raw === "consistency" || raw === "volume" || raw === "active"
    ? raw
    : "streak";
}
