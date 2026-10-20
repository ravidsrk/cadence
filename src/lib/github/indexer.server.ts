/**
 * Leaderboard indexer worker (server-only).
 *
 * Stage 1 discovery feeds `candidate_queue` from four channels — ClickHouse
 * GH Archive event stream, follower-stratified GraphQL search, GitHub
 * Trending, and organic profile views / manual adds. Stage 2 drains the
 * queue with batched GraphQL hydration (8 users / request, 90-day chunk
 * fallback for accounts whose full-year query times out, HTML calendar as
 * last resort), runs the anti-bot assessment, and Stage 3 materializes
 * every sortable window metric into `board_profiles` so /board is one
 * indexed SQL query.
 */
import { getSql, type Sql } from "@/lib/db";
import { BOARD_INDEX_MAX, BOARD_SEEDS } from "./board";
import { fetchCalendar, githubGraphql, hasGithubToken } from "./fetch.server";
import {
  assessBot,
  buildBatchedUserQuery,
  buildFollowerSweepQuery,
  chunkDateRange,
  clickHouseCandidate,
  computeIndexedMetrics,
  FOLLOWER_BUCKETS,
  followerSearchQuery,
  hydratedToCalendar,
  isBotLogin,
  mergeHydratedChunks,
  parseBatchedResponse,
  parseClickHouseRows,
  parseFollowerSweepPage,
  parseGqlUserNode,
  rollingYearRange,
  SOURCE_PRIORITY,
  type Candidate,
  type CandidateSource,
  type GraphqlHydratedUser,
} from "./indexer";
import { todayIso } from "./load";
import { USERNAME_PATTERN } from "./username";

const BATCH_SIZE = 8;
const MAX_ATTEMPTS = 4;
const CLICKHOUSE_URL =
  "https://sql-clickhouse.clickhouse.com/?user=play&default_format=JSONEachRow";

let schemaReadyPromise: Promise<void> | null = null;

/**
 * Idempotent runtime mirror of migrations/0003 — preview PGLite applies the
 * migration file itself, but a warm Neon instance that predates the deploy
 * build (or a board row written before the columns existed) must not crash.
 */
export function ensureIndexerSchema(sql: Sql): Promise<void> {
  schemaReadyPromise ??= (async () => {
    await sql.query(`
      alter table board_profiles
        add column if not exists login_display text,
        add column if not exists display_name text,
        add column if not exists avatar_url text,
        add column if not exists followers integer,
        add column if not exists total_12m integer not null default 0,
        add column if not exists total_90d integer not null default 0,
        add column if not exists total_30d integer not null default 0,
        add column if not exists total_7d integer not null default 0,
        add column if not exists active_days_12m integer not null default 0,
        add column if not exists current_streak integer not null default 0,
        add column if not exists longest_streak integer not null default 0,
        add column if not exists best_day_date text,
        add column if not exists best_day_count integer not null default 0,
        add column if not exists score_12m integer not null default 0,
        add column if not exists score_90d integer not null default 0,
        add column if not exists score_30d integer not null default 0,
        add column if not exists score_7d integer not null default 0,
        add column if not exists momentum_30d integer,
        add column if not exists commits_12m integer,
        add column if not exists prs_12m integer,
        add column if not exists reviews_12m integer,
        add column if not exists issues_12m integer,
        add column if not exists restricted_12m integer,
        add column if not exists source text,
        add column if not exists bot_score double precision not null default 0,
        add column if not exists is_bot boolean not null default false,
        add column if not exists indexed_at timestamptz
    `);
    await sql.query(`
      create table if not exists candidate_queue (
        username text primary key,
        source text not null,
        priority integer not null default 0,
        status text not null default 'pending',
        attempts integer not null default 0,
        last_error text,
        signals jsonb,
        discovered_at timestamptz not null default now(),
        claimed_at timestamptz,
        next_attempt_at timestamptz not null default now(),
        processed_at timestamptz
      )
    `);
    await sql.query(`
      create table if not exists index_runs (
        id bigserial primary key,
        kind text not null,
        status text not null default 'running',
        stats jsonb,
        error text,
        started_at timestamptz not null default now(),
        finished_at timestamptz
      )
    `);
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}

function validLogin(login: string): boolean {
  return USERNAME_PATTERN.test(login) && !isBotLogin(login);
}

/** Enqueue candidates; re-discovery raises priority and re-queues failures. */
export async function enqueueCandidates(
  sql: Sql,
  candidates: Candidate[],
): Promise<number> {
  await ensureIndexerSchema(sql);
  let enqueued = 0;
  for (const candidate of candidates) {
    const login = candidate.username.trim();
    if (!validLogin(login)) continue;
    const lower = login.toLowerCase();
    await sql`
      insert into candidate_queue (username, source, priority, status, signals)
      values (${lower}, ${candidate.source}, ${candidate.priority},
              'pending', ${JSON.stringify(candidate.signals ?? {})}::jsonb)
      on conflict (username) do update set
        priority = greatest(candidate_queue.priority, excluded.priority),
        source = case
          when excluded.priority >= candidate_queue.priority then excluded.source
          else candidate_queue.source end,
        signals = coalesce(candidate_queue.signals, '{}'::jsonb) || excluded.signals,
        status = case
          when candidate_queue.status in ('failed', 'rejected')
            and candidate_queue.attempts < ${MAX_ATTEMPTS}
          then 'pending' else candidate_queue.status end,
        next_attempt_at = case
          when candidate_queue.status in ('failed', 'rejected')
          then now() else candidate_queue.next_attempt_at end
    `;
    enqueued += 1;
  }
  return enqueued;
}

export async function enqueueOne(
  username: string,
  source: CandidateSource,
  signals?: Record<string, number | string>,
): Promise<void> {
  try {
    const sql = await getSql();
    await enqueueCandidates(sql, [
      { username, source, priority: SOURCE_PRIORITY[source], signals },
    ]);
  } catch {
    // Discovery is best-effort; never fail the page that triggered it.
  }
}

/* ------------------------------------------------------------------ */
/* Stage 1: discovery channels                                         */
/* ------------------------------------------------------------------ */

const CLICKHOUSE_QUERY = `
SELECT
  actor_login,
  countIf(event_type = 'PushEvent') AS pushes,
  countIf(event_type = 'PullRequestEvent' AND action = 'opened') AS prs_opened,
  countIf(event_type = 'PullRequestReviewEvent') AS pr_reviews,
  countIf(event_type = 'IssuesEvent' AND action = 'opened') AS issues_opened,
  uniqExact(repo_name) AS distinct_repos,
  uniqExact(toDate(file_time)) AS active_days
FROM github.events
WHERE file_time >= now() - INTERVAL 30 DAY
  AND event_type IN ('PushEvent', 'PullRequestEvent', 'PullRequestReviewEvent', 'IssuesEvent')
  AND NOT endsWith(lower(actor_login), '[bot]')
  AND NOT endsWith(lower(actor_login), '-bot')
  AND NOT endsWith(lower(actor_login), '_bot')
GROUP BY actor_login
HAVING prs_opened >= 10
   AND pr_reviews >= 5
   AND distinct_repos >= 3
   AND active_days >= 15
   AND pushes BETWEEN 30 AND 2000
ORDER BY (prs_opened * 3 + pr_reviews * 2 + issues_opened + least(pushes, 400)) DESC
LIMIT `;

/** Channel 1: live global event stream via the public ClickHouse mirror. */
export async function discoverClickHouse(limit = 500): Promise<Candidate[]> {
  const res = await fetch(CLICKHOUSE_URL, {
    method: "POST",
    body: CLICKHOUSE_QUERY + String(Math.min(1000, Math.max(1, limit))),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`clickhouse ${res.status}`);
  return parseClickHouseRows(await res.text()).map(clickHouseCandidate);
}

/** Channel 2: follower-stratified GraphQL search with inline totals. */
export async function discoverFollowerSweep(
  pagesPerBucket = 2,
): Promise<Candidate[]> {
  if (!hasGithubToken()) return [];
  const query = buildFollowerSweepQuery();
  const out: Candidate[] = [];
  for (const bucket of FOLLOWER_BUCKETS) {
    let cursor: string | null = null;
    for (let page = 0; page < pagesPerBucket; page++) {
      const { body } = await githubGraphql(query, {
        query: followerSearchQuery(bucket),
        cursor,
      });
      const parsed = parseFollowerSweepPage(body);
      out.push(...parsed.candidates);
      if (!parsed.hasNextPage || !parsed.endCursor) break;
      cursor = parsed.endCursor;
    }
  }
  return out;
}

/** Channel 3: trending developers + trending-repo owners (existing treg). */
export async function discoverTrendingCandidates(): Promise<Candidate[]> {
  const { fetchTrendingDevelopers, fetchTrendingRepositories } = await import(
    "./treg.server"
  );
  const out: Candidate[] = [];
  const languages = ["", "typescript", "python", "rust", "go"];
  for (const since of ["daily", "weekly", "monthly"] as const) {
    for (const language of languages) {
      const devs = await fetchTrendingDevelopers({
        language: language || undefined,
        since,
      }).catch(() => null);
      for (const dev of devs?.developers ?? []) {
        out.push({
          username: dev.username,
          source: "trending",
          priority: SOURCE_PRIORITY.trending,
          signals: { language: language || "all", since },
        });
      }
    }
    const repos = await fetchTrendingRepositories({ since }).catch(() => null);
    for (const repo of repos?.repositories ?? []) {
      if (repo.owner) {
        out.push({
          username: repo.owner,
          source: "trending-repo",
          priority: SOURCE_PRIORITY["trending-repo"],
          signals: { repo: repo.fullName, since },
        });
      }
    }
  }
  return out;
}

/** Channel 4a: the original hand-picked seeds stay indexed forever. */
export function seedCandidates(): Candidate[] {
  return BOARD_SEEDS.map((username) => ({
    username,
    source: "seed" as const,
    priority: SOURCE_PRIORITY.seed,
  }));
}

/* ------------------------------------------------------------------ */
/* Stage 2: hydration                                                  */
/* ------------------------------------------------------------------ */

type HydrationResult =
  | { ok: true; user: GraphqlHydratedUser; via: "graphql" | "graphql-90d" | "html" }
  | { ok: false; error: string; terminal?: boolean };

async function hydrateBatchGraphql(
  logins: string[],
  today: string,
  depth = 0,
): Promise<Map<string, GraphqlHydratedUser>> {
  if (!hasGithubToken() || logins.length === 0) return new Map();
  const range = rollingYearRange(today);
  const { body } = await githubGraphql(
    buildBatchedUserQuery(logins),
    { from: `${range.from}T00:00:00Z`, to: `${range.to}T23:59:59Z` },
    45_000,
  );
  const { users, missing } = parseBatchedResponse(body, logins);
  // One heavy account can time out the whole aliased query. If *every* alias
  // came back empty, split once or twice so normal users still batch and
  // only the genuinely heavy login falls through to solo 90-day chunking.
  if (missing.length === logins.length && logins.length > 1 && depth < 2) {
    const mid = Math.ceil(logins.length / 2);
    const [a, b] = await Promise.all([
      hydrateBatchGraphql(logins.slice(0, mid), today, depth + 1),
      hydrateBatchGraphql(logins.slice(mid), today, depth + 1),
    ]);
    return new Map([...a, ...b]);
  }
  return users;
}

/**
 * Heavy accounts (90k+ contributions/year) time out GitHub's full-year
 * contributionsCollection; five sequential 90-day windows succeed where the
 * single 365-day query dies. Falls through to the HTML calendar path.
 */
async function hydrateSolo(login: string, today: string): Promise<HydrationResult> {
  if (hasGithubToken()) {
    const range = rollingYearRange(today);
    const parsedChunks = await Promise.all(
      chunkDateRange(range.from, range.to, 90).map(async (chunk) => {
        const { body } = await githubGraphql(buildBatchedUserQuery([login]), {
          from: `${chunk.from}T00:00:00Z`,
          to: `${chunk.to}T23:59:59Z`,
        });
        const data =
          body && typeof body === "object"
            ? (body as { data?: Record<string, unknown> }).data
            : null;
        return parseGqlUserNode(data?.u0 as never);
      }),
    );
    const chunks = parsedChunks.filter(
      (c): c is GraphqlHydratedUser => c !== null,
    );
    const merged =
      chunks.length === parsedChunks.length
        ? mergeHydratedChunks(chunks)
        : null;
    if (merged && merged.days.length > 0) {
      return { ok: true, user: merged, via: "graphql-90d" };
    }
  }

  const calendar = await fetchCalendar({ username: login, today });
  if ("error" in calendar) {
    return {
      ok: false,
      error: calendar.error,
      terminal: calendar.code === "not_found" || calendar.code === "organization",
    };
  }
  return {
    ok: true,
    via: "html",
    user: {
      profile: { ...calendar.profile, followers: null },
      days: calendar.days,
      // HTML calendars carry no commit/PR split; 0 keeps assessBot from
      // treating unknown diversity as a commit-only firehose.
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      restricted: 0,
      total: calendar.stats.total,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Stage 3: materialize                                                */
/* ------------------------------------------------------------------ */

export async function upsertIndexedProfile(
  sql: Sql,
  user: GraphqlHydratedUser,
  today: string,
  source: string,
  signals?: Record<string, unknown> | null,
): Promise<{ indexed: boolean; isBot: boolean; botScore: number }> {
  const distinctRepos =
    typeof signals?.distinctRepos === "number"
      ? signals.distinctRepos
      : typeof signals?.distinct_repos === "number"
        ? (signals.distinct_repos as number)
        : null;
  const verdict = assessBot({
    login: user.profile.login,
    days: user.days,
    commits: user.commits,
    pullRequests: user.pullRequests,
    reviews: user.reviews,
    issues: user.issues,
    distinctRepos,
  });
  const calendar = hydratedToCalendar(user, today);
  const metrics = computeIndexedMetrics(calendar, today);
  const lower = user.profile.login.toLowerCase();

  const counted = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles where username <> ${lower}
  `;
  if ((counted[0]?.n ?? 0) >= BOARD_INDEX_MAX) {
    return { indexed: false, isBot: verdict.isBot, botScore: verdict.score };
  }

  await sql`
    insert into board_profiles (
      username, calendar_json, cached_today, updated_at,
      login_display, display_name, avatar_url, followers,
      total_12m, total_90d, total_30d, total_7d, active_days_12m,
      current_streak, longest_streak, best_day_date, best_day_count,
      score_12m, score_90d, score_30d, score_7d, momentum_30d,
      commits_12m, prs_12m, reviews_12m, issues_12m, restricted_12m,
      source, bot_score, is_bot, indexed_at
    ) values (
      ${lower}, ${JSON.stringify(calendar)}::jsonb, ${today}, now(),
      ${user.profile.login}, ${user.profile.name}, ${user.profile.avatarUrl},
      ${user.profile.followers},
      ${metrics.total12m}, ${metrics.total90d}, ${metrics.total30d},
      ${metrics.total7d}, ${metrics.activeDays12m},
      ${metrics.currentStreak}, ${metrics.longestStreak},
      ${metrics.bestDayDate}, ${metrics.bestDayCount},
      ${metrics.score12m}, ${metrics.score90d}, ${metrics.score30d},
      ${metrics.score7d}, ${metrics.momentum30d},
      ${user.commits}, ${user.pullRequests}, ${user.reviews},
      ${user.issues}, ${user.restricted},
      ${source}, ${verdict.score}, ${verdict.isBot}, now()
    )
    on conflict (username) do update set
      calendar_json = excluded.calendar_json,
      cached_today = excluded.cached_today,
      updated_at = excluded.updated_at,
      login_display = excluded.login_display,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      followers = coalesce(excluded.followers, board_profiles.followers),
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
      commits_12m = excluded.commits_12m,
      prs_12m = excluded.prs_12m,
      reviews_12m = excluded.reviews_12m,
      issues_12m = excluded.issues_12m,
      restricted_12m = excluded.restricted_12m,
      source = excluded.source,
      bot_score = excluded.bot_score,
      is_bot = excluded.is_bot,
      indexed_at = excluded.indexed_at
  `;
  return { indexed: true, isBot: verdict.isBot, botScore: verdict.score };
}

/* ------------------------------------------------------------------ */
/* Queue processing + orchestration                                    */
/* ------------------------------------------------------------------ */

type QueueRow = {
  username: string;
  source: string;
  attempts: number;
  signals: Record<string, unknown> | string | null;
};

function parseSignals(raw: QueueRow["signals"]): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return raw;
}

async function markQueue(
  sql: Sql,
  username: string,
  status: "done" | "rejected" | "failed" | "pending",
  error?: string,
): Promise<void> {
  if (status === "failed" || status === "pending") {
    await sql`
      update candidate_queue set
        status = case when attempts + 1 >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end,
        attempts = attempts + 1,
        last_error = ${error ?? null},
        next_attempt_at = now() + (interval '15 minutes' * power(2, least(attempts, 5))),
        processed_at = now()
      where username = ${username}
    `;
    return;
  }
  await sql`
    update candidate_queue set
      status = ${status}, attempts = attempts + 1,
      last_error = ${error ?? null}, processed_at = now()
    where username = ${username}
  `;
}

export type ProcessStats = {
  claimed: number;
  indexed: number;
  rejectedBot: number;
  failed: number;
  viaGraphql: number;
  viaGraphql90d: number;
  viaHtml: number;
};

export async function processQueue(input?: {
  limit?: number;
  budgetMs?: number;
}): Promise<ProcessStats> {
  const limit = Math.min(500, Math.max(1, input?.limit ?? 64));
  const budgetMs = input?.budgetMs ?? 110_000;
  const started = Date.now();
  const today = todayIso();
  const sql = await getSql();
  await ensureIndexerSchema(sql);
  await sql.query(
    `alter table candidate_queue add column if not exists claimed_at timestamptz`,
  ).catch(() => {});
  // Reap claims abandoned by a crashed/timed-out worker so they can retry.
  await sql`
    update candidate_queue set status = 'pending', next_attempt_at = now()
    where status = 'processing'
      and (claimed_at is null or claimed_at < now() - interval '10 minutes')
  `;

  const claimed = await sql<QueueRow>`
    update candidate_queue set status = 'processing', claimed_at = now()
    where username in (
      select username from candidate_queue
      where status = 'pending' and next_attempt_at <= now()
      order by priority desc, discovered_at asc
      limit ${limit}
    )
    returning username, source, attempts, signals
  `;

  const stats: ProcessStats = {
    claimed: claimed.length,
    indexed: 0,
    rejectedBot: 0,
    failed: 0,
    viaGraphql: 0,
    viaGraphql90d: 0,
    viaHtml: 0,
  };

  const settle = async (
    row: QueueRow,
    result: HydrationResult,
    viaCount: (key: "viaGraphql" | "viaGraphql90d" | "viaHtml") => void,
  ) => {
    if (!result.ok) {
      stats.failed += 1;
      await markQueue(sql, row.username, result.terminal ? "rejected" : "failed", result.error);
      return;
    }
    const upserted = await upsertIndexedProfile(
      sql,
      result.user,
      today,
      row.source,
      parseSignals(row.signals),
    );
    viaCount(
      result.via === "graphql" ? "viaGraphql" : result.via === "graphql-90d" ? "viaGraphql90d" : "viaHtml",
    );
    if (upserted.isBot) {
      stats.rejectedBot += 1;
      await markQueue(sql, row.username, "rejected", `bot-score ${upserted.botScore.toFixed(2)}`);
    } else if (upserted.indexed) {
      stats.indexed += 1;
      await markQueue(sql, row.username, "done");
    } else {
      await markQueue(sql, row.username, "done", "index-full");
    }
  };

  for (let i = 0; i < claimed.length; i += BATCH_SIZE) {
    const batch = claimed.slice(i, i + BATCH_SIZE);
    const logins = batch.map((r) => r.username);
    const hydrated = await hydrateBatchGraphql(logins, today).catch(
      () => new Map<string, GraphqlHydratedUser>(),
    );
    // Batch hits settle together; misses (the heavy accounts) hydrate solo
    // four at a time — sequential solos were the throughput ceiling.
    const hits = batch.filter((row) => hydrated.has(row.username));
    const misses = batch.filter((row) => !hydrated.has(row.username));
    await Promise.all(
      hits.map((row) =>
        settle(
          row,
          { ok: true, user: hydrated.get(row.username)!, via: "graphql" },
          (k) => {
            stats[k] += 1;
          },
        ),
      ),
    );
    let nextMiss = 0;
    const missWorker = async () => {
      while (nextMiss < misses.length) {
        const row = misses[nextMiss++];
        if (!row) return;
        if (Date.now() - started > budgetMs) {
          stats.claimed -= 1;
          continue; // final sweep below returns it to pending
        }
        const solo = await hydrateSolo(row.username, today).catch(
          (err): HydrationResult => ({
            ok: false,
            error: err instanceof Error ? err.message : "hydration failed",
          }),
        );
        await settle(row, solo, (k) => {
          stats[k] += 1;
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(4, misses.length || 1) }, missWorker),
    );
    if (Date.now() - started > budgetMs) break;
  }
  // Anything claimed but never settled (budget exhausted mid-run) goes back
  // to pending immediately instead of waiting for the stale-claim reaper.
  for (const row of claimed) {
    await sql`
      update candidate_queue set status = 'pending', next_attempt_at = now()
      where username = ${row.username} and status = 'processing'
    `;
  }
  return stats;
}

/** Re-enqueue the stalest indexed profiles so ranks stay fresh. */
export async function enqueueStaleRefresh(limit = 200): Promise<number> {
  const sql = await getSql();
  await ensureIndexerSchema(sql);
  const stale = await sql<{ username: string }>`
    select username from board_profiles
    where not is_bot
      and (indexed_at is null or indexed_at < now() - interval '6 hours')
    order by indexed_at asc nulls first
    limit ${limit}
  `;
  if (stale.length === 0) return 0;
  return enqueueCandidates(
    sql,
    stale.map((r) => ({
      username: r.username,
      source: "refresh" as const,
      priority: SOURCE_PRIORITY.refresh,
    })),
  );
}

export type IndexerRunStats = {
  runId: number | null;
  discovered: Record<string, number>;
  enqueued: number;
  processed: ProcessStats | null;
  errors: string[];
};

let runInFlight: Promise<IndexerRunStats> | null = null;

/** Full pipeline run: discover (all channels) -> enqueue -> drain queue. */
export function runIndexer(input?: {
  kind?: string;
  clickHouseLimit?: number;
  followerPages?: number;
  processLimit?: number;
  budgetMs?: number;
  skipDiscovery?: boolean;
}): Promise<IndexerRunStats> {
  runInFlight ??= runIndexerOnce(input).finally(() => {
    runInFlight = null;
  });
  return runInFlight;
}

async function runIndexerOnce(input?: {
  kind?: string;
  clickHouseLimit?: number;
  followerPages?: number;
  processLimit?: number;
  budgetMs?: number;
  skipDiscovery?: boolean;
}): Promise<IndexerRunStats> {
  const sql = await getSql();
  await ensureIndexerSchema(sql);
  const kind = input?.kind ?? "scheduled";
  const runRows = await sql<{ id: number }>`
    insert into index_runs (kind) values (${kind}) returning id
  `;
  const runId = runRows[0]?.id ?? null;
  const stats: IndexerRunStats = {
    runId,
    discovered: {},
    enqueued: 0,
    processed: null,
    errors: [],
  };

  try {
    if (!input?.skipDiscovery) {
      const channels: Array<[string, () => Promise<Candidate[]>]> = [
        ["clickhouse", () => discoverClickHouse(input?.clickHouseLimit ?? 500)],
        ["followers", () => discoverFollowerSweep(input?.followerPages ?? 2)],
        ["trending", () => discoverTrendingCandidates()],
        ["seeds", async () => seedCandidates()],
      ];
      for (const [name, discover] of channels) {
        try {
          const candidates = await discover();
          stats.discovered[name] = candidates.length;
          stats.enqueued += await enqueueCandidates(sql, candidates);
        } catch (err) {
          stats.discovered[name] = 0;
          stats.errors.push(
            `${name}: ${err instanceof Error ? err.message : "discovery failed"}`,
          );
        }
      }
      stats.enqueued += await enqueueStaleRefresh(200).catch(() => 0);
    }
    stats.processed = await processQueue({
      limit: input?.processLimit ?? 256,
      budgetMs: input?.budgetMs ?? 110_000,
    });
    if (runId !== null) {
      await sql`
        update index_runs set status = 'done', finished_at = now(),
          stats = ${JSON.stringify(stats)}::jsonb
        where id = ${runId}
      `;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "indexer failed";
    stats.errors.push(message);
    if (runId !== null) {
      await sql`
        update index_runs set status = 'failed', finished_at = now(),
          error = ${message}, stats = ${JSON.stringify(stats)}::jsonb
        where id = ${runId}
      `.catch(() => {});
    }
  }
  return stats;
}

export type IndexerStatus = {
  indexed: number;
  botsFiltered: number;
  queue: Record<string, number>;
  lastRun: {
    id: number;
    kind: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
};

export async function getIndexerStatus(): Promise<IndexerStatus> {
  const sql = await getSql();
  await ensureIndexerSchema(sql);
  const [counts, queueRows, lastRuns] = await Promise.all([
    sql<{ indexed: number; bots: number }>`
      select
        count(*) filter (where not is_bot and indexed_at is not null)::int as indexed,
        count(*) filter (where is_bot)::int as bots
      from board_profiles
    `,
    sql<{ status: string; n: number }>`
      select status, count(*)::int as n from candidate_queue group by status
    `,
    sql<{
      id: number;
      kind: string;
      status: string;
      started_at: string | Date;
      finished_at: string | Date | null;
    }>`
      select id, kind, status, started_at, finished_at
      from index_runs order by started_at desc limit 1
    `,
  ]);
  const queue: Record<string, number> = {};
  for (const row of queueRows) queue[row.status] = row.n;
  const last = lastRuns[0];
  const iso = (v: string | Date | null | undefined) =>
    v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    indexed: counts[0]?.indexed ?? 0,
    botsFiltered: counts[0]?.bots ?? 0,
    queue,
    lastRun: last
      ? {
          id: Number(last.id),
          kind: last.kind,
          status: last.status,
          startedAt: iso(last.started_at) ?? "",
          finishedAt: iso(last.finished_at),
        }
      : null,
  };
}
