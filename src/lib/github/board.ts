import { consistency } from "./insights.ts";
import {
  isGithubFnError,
  type CalendarPayload,
  type GithubFnError,
  type GithubProfile,
} from "./types.ts";

/**
 * The board is now a materialized index, not a hand-picked list: up to
 * BOARD_INDEX_MAX verified profiles live in board_profiles and /board pages
 * through them BOARD_PAGE_SIZE at a time. BOARD_MAX stays as the index-cap
 * alias so existing imports keep working.
 */
export const BOARD_INDEX_MAX = 10_000;
export const BOARD_PAGE_SIZE = 100;
export const BOARD_MAX = BOARD_INDEX_MAX;
export const BOARD_SEEDS = [
  "ravidsrk",
  "torvalds",
  "sindresorhus",
  "antfu",
  "shadcn",
  "Rich-Harris",
  "yyx990803",
  "gaearon",
  "tannerlinsley",
  "mitchellh",
  "evanw",
  "BurntSushi",
  "dtolnay",
  "tiangolo",
  "rauchg",
  "karpathy",
] as const;

export type BoardSort =
  | "score"
  | "peak"
  | "day"
  | "streak"
  | "consistency"
  | "volume"
  | "active"
  | "momentum";

export type BoardWindow = "7d" | "30d" | "90d" | "12m";

export type BuilderArchetypeId =
  | "relentless"
  | "surging"
  | "marathoner"
  | "high-output"
  | "peak-striker"
  | "steady";

export type BoardTierId = "apex" | "diamond" | "gold" | "silver" | "bronze";

export function classifyTier(scoreTotal: number): {
  id: BoardTierId;
  label: string;
  shortLabel: string;
  tone: string;
} {
  if (scoreTotal >= 82) {
    return {
      id: "apex",
      label: "Apex",
      shortLabel: "Apex",
      tone: "border-heat-4/45 bg-heat-4/15 text-accent font-medium",
    };
  }
  if (scoreTotal >= 68) {
    return {
      id: "diamond",
      label: "Diamond",
      shortLabel: "Diamond",
      tone: "border-heat-3/45 bg-heat-3/15 text-accent",
    };
  }
  if (scoreTotal >= 52) {
    return {
      id: "gold",
      label: "Gold",
      shortLabel: "Gold",
      tone: "border-heat-2/50 bg-heat-2/20 text-foreground",
    };
  }
  if (scoreTotal >= 36) {
    return {
      id: "silver",
      label: "Silver",
      shortLabel: "Silver",
      tone: "border-border bg-secondary text-muted-foreground",
    };
  }
  return {
    id: "bronze",
    label: "Bronze",
    shortLabel: "Bronze",
    tone: "border-border/60 bg-secondary/60 text-muted-foreground",
  };
}

export type ScoreBreakdown = {
  total: number; // 0..100
  consistencyPts: number; // 0..35
  streakPts: number; // 0..25
  outputPts: number; // 0..25
  rhythmPts: number; // 0..15
};

export type WindowStats = {
  window: BoardWindow;
  windowDays: number;
  total: number;
  activeDays: number;
  consistency: number;
  streak: number;
  longest: number;
  bestDay: { date: string; count: number } | null;
  avgPerActive: number;
  momentumDelta: number | null; // % change vs previous period
  score: ScoreBreakdown;
  archetype: {
    id: BuilderArchetypeId;
    label: string;
    shortLabel: string;
  };
};

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
  score: ScoreBreakdown;
  momentumDelta: number | null;
  archetype: {
    id: BuilderArchetypeId;
    label: string;
    shortLabel: string;
  };
  error: string | null;
};

export function computeCadenceScore(input: {
  total: number;
  activeDays: number;
  windowDays: number;
  currentStreak: number;
  longestStreak: number;
  bestDayCount: number;
}): ScoreBreakdown {
  const w = Math.max(1, input.windowDays);
  const consistencyRatio = Math.min(1, Math.max(0, input.activeDays / w));
  const consistencyPts = Math.round(consistencyRatio * 35);

  const streakTarget = Math.min(w, 45);
  const longestTarget = Math.min(w, 90);
  const curNorm = Math.min(1, input.currentStreak / Math.max(1, streakTarget));
  const longNorm = Math.min(1, input.longestStreak / Math.max(1, longestTarget));
  const streakPts = Math.round((curNorm * 0.55 + longNorm * 0.45) * 25);

  const dailyRate = input.total / w;
  const outputNorm = Math.min(
    1,
    Math.log10(1 + dailyRate * 12) / Math.log10(1 + 120),
  );
  const outputPts = Math.round(outputNorm * 25);

  const spikeShare =
    input.total > 0 && input.bestDayCount > 0
      ? input.bestDayCount / input.total
      : 1;
  const maxAllowedSpike = w <= 7 ? 0.65 : w <= 30 ? 0.45 : 0.25;
  const balanceRatio =
    input.total > 0
      ? Math.max(
          0,
          Math.min(1, (1 - Math.max(0, spikeShare - maxAllowedSpike)) / 0.85),
        )
      : 0;
  const rhythmPts = Math.round(balanceRatio * 15);

  return {
    total: Math.min(100, consistencyPts + streakPts + outputPts + rhythmPts),
    consistencyPts,
    streakPts,
    outputPts,
    rhythmPts,
  };
}

export function classifyArchetype(input: {
  consistency: number;
  streak: number;
  longest: number;
  avgPerActive: number;
  bestDayCount: number;
  momentumDelta: number | null;
  windowDays: number;
}): { id: BuilderArchetypeId; label: string; shortLabel: string } {
  const streakThreshold = Math.min(14, Math.max(4, Math.round(input.windowDays * 0.35)));
  const marathonThreshold = Math.min(45, Math.max(6, Math.round(input.windowDays * 0.6)));
  if (input.consistency >= 0.72 && input.streak >= streakThreshold) {
    return { id: "relentless", label: "Relentless", shortLabel: "Relentless" };
  }
  if (input.momentumDelta !== null && input.momentumDelta >= 25 && input.consistency >= 0.25) {
    return { id: "surging", label: "Surging Velocity", shortLabel: "Surging" };
  }
  if (input.longest >= marathonThreshold || input.consistency >= 0.65) {
    return { id: "marathoner", label: "Marathoner", shortLabel: "Marathon" };
  }
  if (input.avgPerActive >= 9 && input.consistency >= 0.3) {
    return { id: "high-output", label: "High-Output", shortLabel: "Heavy" };
  }
  if (input.bestDayCount >= 30) {
    return { id: "peak-striker", label: "Peak Striker", shortLabel: "Striker" };
  }
  return { id: "steady", label: "Steady Shipper", shortLabel: "Steady" };
}

function isoDateDaysAgo(todayIso: string, daysAgo: number): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return dt.toISOString().slice(0, 10);
}

export function computeWindowStats(
  entry: Omit<BoardEntry, "rank">,
  window: BoardWindow,
  todayIso: string,
): WindowStats {
  const windowDays =
    window === "7d" ? 7 : window === "30d" ? 30 : window === "90d" ? 90 : 365;

  if (window === "12m" && Object.keys(entry.byDate).length === 0 && entry.total > 0) {
    return {
      window,
      windowDays,
      total: entry.total,
      activeDays: entry.activeDays,
      consistency: entry.consistency,
      streak: entry.streak,
      longest: entry.longest,
      bestDay: entry.bestDay,
      avgPerActive: entry.activeDays > 0 ? entry.total / entry.activeDays : 0,
      momentumDelta: entry.momentumDelta,
      score: entry.score,
      archetype: entry.archetype,
    };
  }

  let total = 0;
  let activeDays = 0;
  let longest = 0;
  let running = 0;
  let bestDay: { date: string; count: number } | null = null;

  for (let i = windowDays - 1; i >= 0; i--) {
    const date = isoDateDaysAgo(todayIso, i);
    const count = entry.byDate[date] ?? 0;
    total += count;
    if (count > 0) {
      activeDays += 1;
      running += 1;
      if (running > longest) longest = running;
      if (!bestDay || count > bestDay.count) {
        bestDay = { date, count };
      }
    } else {
      running = 0;
    }
  }

  // Current streak up to today or yesterday
  let streak = 0;
  const todayCount = entry.byDate[todayIso] ?? 0;
  const startOffset = todayCount > 0 ? 0 : 1;
  for (let i = startOffset; i < windowDays; i++) {
    const date = isoDateDaysAgo(todayIso, i);
    const count = entry.byDate[date] ?? 0;
    if (count > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  // Compute momentum delta: compare recent period (min(windowDays, 30) days) vs preceding period of equal length
  const periodLen = window === "7d" ? 7 : 30;
  let recentSum = 0;
  let prevSum = 0;
  for (let i = 0; i < periodLen; i++) {
    recentSum += entry.byDate[isoDateDaysAgo(todayIso, i)] ?? 0;
    prevSum += entry.byDate[isoDateDaysAgo(todayIso, i + periodLen)] ?? 0;
  }
  const momentumDelta =
    prevSum >= 5
      ? Math.round(((recentSum - prevSum) / prevSum) * 100)
      : recentSum >= 10
        ? 100
        : null;

  const consistencyRatio = activeDays / windowDays;
  const avgPerActive = activeDays > 0 ? total / activeDays : 0;
  const score = computeCadenceScore({
    total,
    activeDays,
    windowDays,
    currentStreak: streak,
    longestStreak: longest,
    bestDayCount: bestDay?.count ?? 0,
  });
  const archetype = classifyArchetype({
    consistency: consistencyRatio,
    streak,
    longest,
    avgPerActive,
    bestDayCount: bestDay?.count ?? 0,
    momentumDelta,
    windowDays,
  });

  return {
    window,
    windowDays,
    total,
    activeDays,
    consistency: consistencyRatio,
    streak,
    longest,
    bestDay,
    avgPerActive,
    momentumDelta,
    score,
    archetype,
  };
}

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
      score: {
        total: 0,
        consistencyPts: 0,
        streakPts: 0,
        outputPts: 0,
        rhythmPts: 0,
      },
      momentumDelta: null,
      archetype: { id: "steady", label: "Steady Shipper", shortLabel: "Steady" },
      error: calendar.error,
    };
  }
  const byDate: Record<string, number> = {};
  for (const day of calendar.days) {
    if (day.count > 0) byDate[day.date] = day.count;
  }
  const consistencyStats = consistency(calendar.days);
  const windowDays = Math.max(1, calendar.days.length);
  const score = computeCadenceScore({
    total: calendar.stats.total,
    activeDays: calendar.stats.activeDays,
    windowDays,
    currentStreak: calendar.stats.currentStreak,
    longestStreak: calendar.stats.longestStreak,
    bestDayCount: calendar.stats.bestDay?.count ?? 0,
  });

  // Compute 30d vs prior 30d momentum from the tail of calendar.days
  let momentumDelta: number | null = null;
  if (calendar.days.length >= 60) {
    const recent30 = calendar.days
      .slice(-30)
      .reduce((acc, d) => acc + d.count, 0);
    const prev30 = calendar.days
      .slice(-60, -30)
      .reduce((acc, d) => acc + d.count, 0);
    if (prev30 >= 5) {
      momentumDelta = Math.round(((recent30 - prev30) / prev30) * 100);
    } else if (recent30 >= 10) {
      momentumDelta = 100;
    }
  }

  const archetype = classifyArchetype({
    consistency: consistencyStats.activeRatio,
    streak: calendar.stats.currentStreak,
    longest: calendar.stats.longestStreak,
    avgPerActive: consistencyStats.avgOnActive,
    bestDayCount: calendar.stats.bestDay?.count ?? 0,
    momentumDelta,
    windowDays,
  });

  return {
    username: calendar.profile.login,
    profile: calendar.profile,
    streak: calendar.stats.currentStreak,
    longest: calendar.stats.longestStreak,
    consistency: consistencyStats.activeRatio,
    activeDays: calendar.stats.activeDays,
    total: calendar.stats.total,
    bestDay: calendar.stats.bestDay,
    byDate,
    score,
    momentumDelta,
    archetype,
    error: null,
  };
}

function metric(
  entry: Omit<BoardEntry, "rank">,
  sort: BoardSort,
  date?: string,
): number {
  if (sort === "day" && date) return entry.byDate[date] ?? 0;
  if (sort === "score") return entry.score.total;
  if (sort === "peak") return entry.bestDay?.count ?? 0;
  if (sort === "consistency") return entry.consistency;
  if (sort === "volume") return entry.total;
  if (sort === "active") return entry.activeDays;
  if (sort === "momentum") return entry.momentumDelta ?? -999;
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
    const scoreDiff = (b.score?.total ?? 0) - (a.score?.total ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
  });
  return copy.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export type BoardSearch = {
  d?: string;
  s?: Exclude<BoardSort, "score">;
  w?: Exclude<BoardWindow, "12m">;
};

export function parseBoardSort(raw: unknown): BoardSort {
  if (
    raw === "score" ||
    raw === "peak" ||
    raw === "streak" ||
    raw === "consistency" ||
    raw === "volume" ||
    raw === "active" ||
    raw === "momentum" ||
    raw === "day"
  ) {
    return raw;
  }
  return "score";
}

export function parseBoardWindow(raw: unknown): BoardWindow {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "12m") {
    return raw;
  }
  return "12m";
}

export function boardSearchFromState(input: {
  sort: BoardSort;
  date?: string;
  window?: BoardWindow;
}): BoardSearch {
  const out: BoardSearch = {};
  if (input.window && input.window !== "12m") {
    out.w = input.window;
  }
  if (input.date) {
    out.d = input.date;
    return out;
  }
  if (input.sort !== "score" && input.sort !== "day") {
    out.s = input.sort;
  }
  return out;
}
