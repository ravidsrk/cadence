import { getSql, type Sql } from "@/lib/db";
import {
  BOARD_INDEX_MAX,
  BOARD_PAGE_SIZE,
  BOARD_SEEDS,
  rankBoard,
  type BoardEntry,
  type BoardSort,
  type BoardWindow,
} from "./board";
import { fetchCalendar } from "./fetch.server";
import { computeIndexedMetrics, SOURCE_PRIORITY } from "./indexer";
import {
  enqueueCandidates,
  ensureIndexerSchema,
  processQueue,
  type IndexerStatus,
} from "./indexer.server";
import { todayIso } from "./load";
import { normalizeUsername } from "./username";
import type { CalendarPayload, GithubFnError } from "./types";

export type BoardPayload = {
  today: string;
  max: number;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  entries: BoardEntry[];
  indexer: IndexerStatus | null;
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureBoardColumns(sql: Sql): Promise<void> {
  schemaReadyPromise ??= (async () => {
    await sql`
      alter table board_profiles
        add column if not exists calendar_json jsonb,
        add column if not exists cached_today text,
        add column if not exists updated_at timestamptz
    `;
    await ensureIndexerSchema(sql);
    for (const seed of BOARD_SEEDS) {
      const login = seed.toLowerCase();
      await sql`
        insert into board_profiles (username)
        values (${login})
        on conflict (username) do nothing
      `;
    }
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}

type StoredBoardRow = {
  username: string;
  calendar_json: CalendarPayload | string | null;
  cached_today: string | null;
  updated_at: string | Date | null;
};

function parseStoredCalendar(
  raw: CalendarPayload | string | null,
): CalendarPayload | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as CalendarPayload;
      return parsed && typeof parsed === "object" && Array.isArray(parsed.days)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" && Array.isArray(raw.days) ? raw : null;
}

/**
 * Persist a calendar snapshot AND its materialized window metrics, so every
 * write path (indexer, organic profile view, manual add) keeps the SQL-ranked
 * columns in sync with calendar_json.
 */
async function persistCalendarSnapshot(
  sql: Sql,
  username: string,
  today: string,
  calendar: CalendarPayload,
  source = "organic",
): Promise<void> {
  try {
    const metrics = computeIndexedMetrics(calendar, today);
    await sql`
      insert into board_profiles (
        username, calendar_json, cached_today, updated_at,
        login_display, display_name, avatar_url,
        total_12m, total_90d, total_30d, total_7d, active_days_12m,
        current_streak, longest_streak, best_day_date, best_day_count,
        score_12m, score_90d, score_30d, score_7d, momentum_30d,
        source, indexed_at
      ) values (
        ${username}, ${JSON.stringify(calendar)}::jsonb, ${today}, now(),
        ${calendar.profile.login}, ${calendar.profile.name}, ${calendar.profile.avatarUrl},
        ${metrics.total12m}, ${metrics.total90d}, ${metrics.total30d},
        ${metrics.total7d}, ${metrics.activeDays12m},
        ${metrics.currentStreak}, ${metrics.longestStreak},
        ${metrics.bestDayDate}, ${metrics.bestDayCount},
        ${metrics.score12m}, ${metrics.score90d}, ${metrics.score30d},
        ${metrics.score7d}, ${metrics.momentum30d},
        ${source}, now()
      )
      on conflict (username) do update set
        calendar_json = excluded.calendar_json,
        cached_today = excluded.cached_today,
        updated_at = excluded.updated_at,
        login_display = excluded.login_display,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        total_12m = excluded.total_12m,
        total_90d = excluded.total_90d,
        total_30d = excluded.total_30d,
        total_7d = excluded.total_7d,
        active_days_12m = excluded.active_days_12m,
        current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        best_day_date = excluded.best_day_date,
        best_day_count = excluded.best_day_count,
        score_12m = excluded.score_12m,
        score_90d = excluded.score_90d,
        score_30d = excluded.score_30d,
        score_7d = excluded.score_7d,
        momentum_30d = excluded.momentum_30d,
        source = excluded.source,
        indexed_at = excluded.indexed_at
    `;
  } catch {
    // Non-fatal cache write failure
  }
}

/** Channel 4: every viewed profile joins the index (no 48-profile ceiling). */
export async function autoSyncBoardProfile(
  calendar: CalendarPayload,
  today: string,
): Promise<void> {
  try {
    const login = calendar.profile.login.toLowerCase();
    const sql = await getSql();
    await ensureBoardColumns(sql);
    const counted = await sql<{ n: number }>`
      select count(*)::int as n from board_profiles where username <> ${login}
    `;
    if ((counted[0]?.n ?? 0) >= BOARD_INDEX_MAX) return;
    await persistCalendarSnapshot(sql, login, today, calendar, "organic");
    await enqueueCandidates(sql, [
      {
        username: login,
        source: "organic",
        priority: SOURCE_PRIORITY.organic,
      },
    ]).catch(() => 0);
  } catch {
    // Non-fatal background sync
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item === undefined) return;
      out[index] = await fn(item);
    }
  }
  const n = Math.min(Math.max(limit, 1), items.length || 1);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/* ------------------------------------------------------------------ */
/* SQL-ranked board read                                               */
/* ------------------------------------------------------------------ */

const SORT_COLUMNS: Record<BoardSort, Record<BoardWindow, string>> = {
  score: { "7d": "score_7d", "30d": "score_30d", "90d": "score_90d", "12m": "score_12m" },
  volume: { "7d": "total_7d", "30d": "total_30d", "90d": "total_90d", "12m": "total_12m" },
  peak: { "7d": "best_day_count", "30d": "best_day_count", "90d": "best_day_count", "12m": "best_day_count" },
  streak: { "7d": "current_streak", "30d": "current_streak", "90d": "current_streak", "12m": "current_streak" },
  consistency: { "7d": "active_days_12m", "30d": "active_days_12m", "90d": "active_days_12m", "12m": "active_days_12m" },
  active: { "7d": "active_days_12m", "30d": "active_days_12m", "90d": "active_days_12m", "12m": "active_days_12m" },
  momentum: { "7d": "momentum_30d", "30d": "momentum_30d", "90d": "momentum_30d", "12m": "momentum_30d" },
  day: { "7d": "score_7d", "30d": "score_30d", "90d": "score_90d", "12m": "score_12m" },
};

export type LoadBoardOptions = {
  sort?: BoardSort;
  window?: BoardWindow;
  limit?: number;
  offset?: number;
};

export async function loadBoard(
  input: BoardSort | LoadBoardOptions = "score",
): Promise<BoardPayload> {
  const options: LoadBoardOptions =
    typeof input === "string" ? { sort: input } : input;
  const sort = options.sort ?? "score";
  const window = options.window ?? "12m";
  const limit = Math.min(200, Math.max(1, options.limit ?? BOARD_PAGE_SIZE));
  const offset = Math.max(0, options.offset ?? 0);
  const today = todayIso();
  const sql = await getSql();
  await ensureBoardColumns(sql);

  const totals = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles
    where not is_bot and calendar_json is not null
  `;
  const total = totals[0]?.n ?? 0;

  if (total === 0 && offset === 0) {
    // Cold start (fresh preview DB): live-hydrate the seed rows once, persist
    // them with metrics, and enqueue everything for the background indexer.
    const stored = await sql<StoredBoardRow>`
      select username, calendar_json, cached_today, updated_at
      from board_profiles order by added_at asc limit ${limit}
    `;
    const rows = await mapPool(stored, 8, async (row) => {
      const cachedCal = parseStoredCalendar(row.calendar_json);
      if (cachedCal) return { username: row.username, calendar: cachedCal as CalendarPayload | GithubFnError };
      const live = await fetchCalendar({ username: row.username, today });
      if (!("error" in live)) {
        void persistCalendarSnapshot(sql, row.username, today, live, "seed");
      }
      return { username: row.username, calendar: live };
    });
    void enqueueCandidates(
      sql,
      stored.map((r) => ({
        username: r.username,
        source: "seed" as const,
        priority: SOURCE_PRIORITY.seed,
      })),
    ).catch(() => 0);
    return {
      today,
      max: BOARD_INDEX_MAX,
      total: rows.filter((r) => !("error" in r.calendar)).length,
      offset: 0,
      limit,
      hasMore: false,
      entries: rankBoard(rows, sort),
      indexer: null,
    };
  }

  const column = SORT_COLUMNS[sort][window];
  const rows = await sql.query<StoredBoardRow>(
    `select username, calendar_json, cached_today, updated_at
     from board_profiles
     where not is_bot and calendar_json is not null
     order by ${column} desc nulls last, score_12m desc, username asc
     limit $1 offset $2`,
    [limit, offset],
  );

  const calendars = rows.flatMap((row) => {
    const calendar = parseStoredCalendar(row.calendar_json);
    return calendar ? [{ username: row.username, calendar }] : [];
  });
  const entries = rankBoard(calendars, sort).map((entry, i) => ({
    ...entry,
    rank: offset + i + 1,
  }));

  const { getIndexerStatus } = await import("./indexer.server");
  const indexer = await getIndexerStatus().catch(() => null);
  return {
    today,
    max: BOARD_INDEX_MAX,
    total,
    offset,
    limit,
    hasMore: offset + entries.length < total,
    entries,
    indexer,
  };
}

export async function addBoardProfile(
  raw: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, error: "Enter a GitHub username or profile URL." };
  }
  const login = username.toLowerCase();
  const sql = await getSql();
  await ensureBoardColumns(sql);
  const existing = await sql<{ username: string }>`
    select username from board_profiles where username = ${login} limit 1
  `;
  const today = todayIso();
  if (existing[0]) {
    const calendar = await fetchCalendar({ username: login, today });
    if (!("error" in calendar)) {
      await persistCalendarSnapshot(sql, login, today, calendar, "manual");
    }
    return { ok: true, already: true };
  }
  const counted = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles
  `;
  if ((counted[0]?.n ?? 0) >= BOARD_INDEX_MAX) {
    return { ok: false, error: `Leaderboard index is full (${BOARD_INDEX_MAX} profiles).` };
  }
  const calendar = await fetchCalendar({ username: login, today });
  if ("error" in calendar) {
    if (calendar.code === "not_found") {
      return { ok: false, error: "GitHub has no public user with that login." };
    }
    return { ok: false, error: calendar.error };
  }
  await persistCalendarSnapshot(sql, login, today, calendar, "manual");
  await enqueueCandidates(sql, [
    { username: login, source: "manual", priority: SOURCE_PRIORITY.manual },
  ]).catch(() => 0);
  return { ok: true, already: false };
}

/**
 * Trending discovery now feeds the candidate queue and drains a small batch
 * inline so the click still lands builders on the board immediately; the
 * rest are picked up by the next scheduled indexer run.
 */
async function syncCandidatesToBoard(
  usernames: string[],
  source: "trending" | "trending-repo",
): Promise<{ enqueued: number; addedCount: number }> {
  const sql = await getSql();
  await ensureBoardColumns(sql);
  const before = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles
    where not is_bot and calendar_json is not null
  `;
  const enqueued = await enqueueCandidates(
    sql,
    usernames.map((username) => ({
      username,
      source,
      priority: SOURCE_PRIORITY[source],
    })),
  );
  await processQueue({ limit: 24, budgetMs: 25_000 }).catch(() => null);
  const after = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles
    where not is_bot and calendar_json is not null
  `;
  return {
    enqueued,
    addedCount: Math.max(0, (after[0]?.n ?? 0) - (before[0]?.n ?? 0)),
  };
}

export async function discoverTrendingDevelopers(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
  syncToBoard?: boolean;
}) {
  const { fetchTrendingDevelopers } = await import("./treg.server");
  const result = await fetchTrendingDevelopers({
    language: input.language,
    since: input.since,
  });
  let addedCount = 0;
  let enqueued = 0;
  if (input.syncToBoard && result.developers.length > 0) {
    ({ addedCount, enqueued } = await syncCandidatesToBoard(
      result.developers.map((d) => d.username),
      "trending",
    ));
  }
  return { ...result, addedCount, enqueued };
}

export async function discoverTrendingRepositories(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
  syncToBoard?: boolean;
}) {
  const { fetchTrendingRepositories } = await import("./treg.server");
  const result = await fetchTrendingRepositories({
    language: input.language,
    since: input.since,
  });
  let addedCount = 0;
  let enqueued = 0;
  if (input.syncToBoard && result.repositories.length > 0) {
    const owners = Array.from(new Set(result.repositories.map((r) => r.owner)));
    ({ addedCount, enqueued } = await syncCandidatesToBoard(owners, "trending-repo"));
  }
  return { ...result, addedCount, enqueued };
}
