import { assignLevels, computeStats } from "./stats";
import type { CalendarPayload } from "./types";

export const RECENT_STORAGE_KEY = "cadence:recent";
export const LAST_VIEWED_STORAGE_KEY = "cadence:username";
export const LANDING_DRAFT_SESSION_KEY = "cadence:landing-draft";
const SUMMARY_STORAGE_PREFIX = "cadence:summary:";
const STALE_CAL_STORAGE_PREFIX = "cadence:stale-cal:";
export const MAX_RECENT_PROFILES = 5;

export type FeaturedProfileMeta = {
  login: string;
  name: string;
  avatarUrl: string;
  role: string;
};

export const FEATURED_PROFILES: readonly FeaturedProfileMeta[] = [
  {
    login: "torvalds",
    name: "Linus Torvalds",
    avatarUrl: "https://github.com/torvalds.png?size=96",
    role: "Linux kernel & Git",
  },
  {
    login: "gaearon",
    name: "Dan Abramov",
    avatarUrl: "https://github.com/gaearon.png?size=96",
    role: "React & Bluesky",
  },
  {
    login: "yyx990803",
    name: "Evan You",
    avatarUrl: "https://github.com/yyx990803.png?size=96",
    role: "Vue & Vite",
  },
  {
    login: "sindresorhus",
    name: "Sindre Sorhus",
    avatarUrl: "https://github.com/sindresorhus.png?size=96",
    role: "Open source maintainer",
  },
] as const;

export type CachedProfileSummary = {
  login: string;
  name: string | null;
  avatarUrl: string;
  total: number;
  currentStreak: number;
  activeDays: number;
  updatedAt: number;
};

export function readRecentProfiles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(trimmed);
      if (out.length >= MAX_RECENT_PROFILES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function addRecentProfile(username: string): string[] {
  const trimmed = username.trim();
  if (!trimmed || typeof window === "undefined") return [];
  const lower = trimmed.toLowerCase();
  const current = readRecentProfiles().filter(
    (u) => u.toLowerCase() !== lower,
  );
  const next = [trimmed, ...current].slice(0, MAX_RECENT_PROFILES);
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(LAST_VIEWED_STORAGE_KEY, trimmed);
  } catch {
    // ignore localStorage write errors
  }
  return next;
}

export function removeRecentProfile(username: string): string[] {
  const lower = username.trim().toLowerCase();
  const next = readRecentProfiles().filter((u) => u.toLowerCase() !== lower);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearRecentProfiles(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readLastViewedProfile(): string | null {
  if (typeof window === "undefined") return null;
  const recent = readRecentProfiles();
  if (recent[0]) return recent[0];
  try {
    const legacy = window.localStorage.getItem(LAST_VIEWED_STORAGE_KEY);
    return legacy?.trim() || null;
  } catch {
    return null;
  }
}

export function saveCachedProfileSummary(calendar: CalendarPayload): void {
  if (typeof window === "undefined") return;
  try {
    const login = calendar.profile.login;
    const summary: CachedProfileSummary = {
      login,
      name: calendar.profile.name,
      avatarUrl: calendar.profile.avatarUrl,
      total: calendar.stats.total,
      currentStreak: calendar.stats.currentStreak,
      activeDays: calendar.stats.activeDays,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      `${SUMMARY_STORAGE_PREFIX}${login.toLowerCase()}`,
      JSON.stringify(summary),
    );
  } catch {
    // ignore
  }
}

export function readCachedProfileSummary(
  username: string,
): CachedProfileSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${SUMMARY_STORAGE_PREFIX}${username.trim().toLowerCase()}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfileSummary;
    if (
      !parsed ||
      typeof parsed.login !== "string" ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveClientStaleCalendar(
  username: string,
  year: number | undefined,
  calendar: CalendarPayload,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${STALE_CAL_STORAGE_PREFIX}${username.trim().toLowerCase()}:${year ?? "rolling"}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), calendar }),
    );
  } catch {
    // ignore quota errors
  }
}

export function readClientStaleCalendar(
  username: string,
  year: number | undefined,
): { payload: CalendarPayload; updatedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `${STALE_CAL_STORAGE_PREFIX}${username.trim().toLowerCase()}:${year ?? "rolling"}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      at?: number;
      calendar?: CalendarPayload;
    };
    if (!parsed?.calendar || typeof parsed.at !== "number") return null;
    return { payload: parsed.calendar, updatedAt: parsed.at };
  } catch {
    return null;
  }
}

export function formatRelativeTimeAgo(
  timestampMs: number,
  nowMs = Date.now(),
): string {
  const diffSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  return `${diffDays}d ago`;
}

/**
 * Deterministic bundled sample data for the static example preview on `/`
 * so the landing page never blocks on network fetches or imports chart libraries.
 */
export function buildSamplePreviewCalendar(): CalendarPayload {
  const rawDays: Array<{ date: string; count: number }> = [];
  const end = new Date("2026-10-17T00:00:00Z");
  for (let i = 181; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    const seed = (i * 37 + 13) % 29;
    let count = 0;
    if (dow === 0 || dow === 6) {
      count = seed > 18 ? (seed - 16) * 3 : seed > 10 ? 4 : 0;
    } else {
      count =
        seed === 0
          ? 0
          : seed > 25
            ? 220 + seed * 4
            : seed > 18
              ? 64 + seed * 2
              : seed > 8
                ? 14 + seed
                : 3 + seed;
    }
    rawDays.push({ date: iso, count });
  }
  const days = assignLevels(rawDays);
  const stats = computeStats(days, "2026-10-17", true);
  return {
    username: "torvalds",
    profile: {
      login: "torvalds",
      name: "Linus Torvalds",
      avatarUrl: "https://github.com/torvalds.png?size=96",
      htmlUrl: "https://github.com/torvalds",
      bio: "Creator of Linux and Git",
    },
    range: {
      from: days[0]!.date,
      to: days[days.length - 1]!.date,
    },
    days,
    stats: {
      ...stats,
      priorTotal: Math.round(stats.total * 0.88),
      priorPeriodLabel: "prior 12 months",
    },
  };
}
