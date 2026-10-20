/**
 * Pure core of the multi-source leaderboard indexer: candidate scoring,
 * anti-bot assessment, per-window metric materialization, and the parsers /
 * query builders for the ClickHouse GH Archive mirror and batched GitHub
 * GraphQL. No I/O here — `indexer.server.ts` owns fetch, SQL, and scheduling
 * so every rule in this file is unit-testable offline.
 */
import {
  boardEntryFromCalendar,
  computeWindowStats,
  type BoardWindow,
} from "./board.ts";
import { assignLevels, computeStats } from "./stats.ts";
import type { CalendarPayload, DayCount, GithubProfile } from "./types.ts";

export type CandidateSource =
  | "clickhouse"
  | "followers"
  | "trending"
  | "trending-repo"
  | "organic"
  | "manual"
  | "seed"
  | "refresh";

export type Candidate = {
  username: string; // canonical-cased login as discovered
  source: CandidateSource;
  priority: number;
  signals?: Record<string, number | string>;
};

/** Source base priorities: fresher, higher-intent signals drain first. */
export const SOURCE_PRIORITY: Record<CandidateSource, number> = {
  manual: 1_000,
  organic: 800,
  clickhouse: 600,
  trending: 500,
  "trending-repo": 450,
  followers: 300,
  seed: 200,
  refresh: 100,
};

export type ClickHouseSignals = {
  pushes: number;
  prsOpened: number;
  prReviews: number;
  issuesOpened: number;
  distinctRepos: number;
  activeDays: number;
};

export type ClickHouseRow = { login: string; signals: ClickHouseSignals };

/**
 * Parse ClickHouse JSONEachRow output. Counts arrive as strings; malformed
 * lines and bot-looking logins are dropped, never guessed at.
 */
export function parseClickHouseRows(text: string): ClickHouseRow[] {
  const out: ClickHouseRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const login = typeof row.actor_login === "string" ? row.actor_login : "";
    if (!login || isBotLogin(login)) continue;
    const num = (key: string) => {
      const n = Number(row[key]);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    };
    out.push({
      login,
      signals: {
        pushes: num("pushes"),
        prsOpened: num("prs_opened"),
        prReviews: num("pr_reviews"),
        issuesOpened: num("issues_opened"),
        distinctRepos: num("distinct_repos"),
        activeDays: num("active_days"),
      },
    });
  }
  return out;
}

/** Same weighted score the ClickHouse query orders by — kept in one place. */
export function clickHousePriority(signals: ClickHouseSignals): number {
  const weighted =
    signals.prsOpened * 3 +
    signals.prReviews * 2 +
    signals.issuesOpened +
    Math.min(signals.pushes, 400);
  return SOURCE_PRIORITY.clickhouse + Math.min(300, Math.round(weighted / 4));
}

export function clickHouseCandidate(row: ClickHouseRow): Candidate {
  return {
    username: row.login,
    source: "clickhouse",
    priority: clickHousePriority(row.signals),
    signals: { ...row.signals },
  };
}

/**
 * Follower-stratified sweep buckets. GitHub search caps one query at 1,000
 * results, so the sweep walks disjoint follower ranges top-down; each page
 * of 10 with inline contributionsCollection costs 1 GraphQL point.
 */
export const FOLLOWER_BUCKETS = [
  "followers:>100000",
  "followers:50000..100000",
  "followers:20000..49999",
  "followers:10000..19999",
  "followers:5000..9999",
  "followers:2000..4999",
  "followers:1000..1999",
] as const;

export function followerSearchQuery(bucket: string): string {
  return `${bucket} sort:followers-desc`;
}

/* ------------------------------------------------------------------ */
/* Anti-bot / cron-spam assessment                                     */
/* ------------------------------------------------------------------ */

const BOT_SUFFIX = /(?:\[bot\]|-bot|_bot|bot)$/i;
const BOT_SUBSTRINGS = [
  "dependabot",
  "renovate",
  "github-actions",
  "codecov",
  "snyk-",
  "mergify",
  "allcontributors",
  "semantic-release",
  "greenkeeper",
  "imgbot",
  "stale-",
  "automation",
  "ci-bot",
];

export function isBotLogin(login: string): boolean {
  const lower = login.trim().toLowerCase();
  if (!lower) return true;
  if (BOT_SUFFIX.test(lower)) return true;
  return BOT_SUBSTRINGS.some((s) => lower.includes(s));
}

export type BotAssessment = {
  isBot: boolean;
  score: number; // 0..1, higher = more bot-like
  reasons: string[];
};

/**
 * Conservative by design: prolific humans (200+/day with real PR/review
 * diversity) must pass. A candidate is rejected only on a hard rule
 * (bot login, org, no activity) or a stacked score >= 0.7 from independent
 * cron/spam signals — constant-cadence 365/365 calendars, single-day bulk
 * dumps, and commit-only firehoses with zero collaboration diversity.
 */
export function assessBot(input: {
  login: string;
  days: DayCount[];
  commits?: number | null;
  pullRequests?: number | null;
  reviews?: number | null;
  issues?: number | null;
  distinctRepos?: number | null;
}): BotAssessment {
  const reasons: string[] = [];
  if (isBotLogin(input.login)) {
    return { isBot: true, score: 1, reasons: ["bot-login"] };
  }
  const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  const total = days.reduce((s, d) => s + d.count, 0);
  if (days.length === 0 || total === 0) {
    return { isBot: true, score: 1, reasons: ["no-activity"] };
  }

  let score = 0;
  const active = days.filter((d) => d.count > 0);
  const activeRatio = active.length / days.length;
  const best = Math.max(...days.map((d) => d.count));

  // Cron signature: active essentially every day with near-constant counts.
  if (active.length >= 60) {
    const mean = total / active.length;
    const variance =
      active.reduce((s, d) => s + (d.count - mean) ** 2, 0) / active.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    if (activeRatio >= 0.98 && cv < 0.2 && mean <= 12) {
      score += 0.45;
      reasons.push("constant-cron-cadence");
    }
    // Identical-count runs (e.g. exactly 1 commit/day from a scheduled job).
    const modeCount = new Map<number, number>();
    for (const d of active) modeCount.set(d.count, (modeCount.get(d.count) ?? 0) + 1);
    const modeShare = Math.max(...modeCount.values()) / active.length;
    if (activeRatio >= 0.95 && modeShare >= 0.9) {
      score += 0.35;
      reasons.push("identical-daily-count");
    }
  }

  // Bulk dump: most of a year's volume lands on one or two days.
  if (total >= 500 && best / total >= 0.5) {
    score += 0.35;
    reasons.push("single-day-bulk-dump");
  }

  // Commit-only firehose: huge commit volume, zero reviewed/opened work and
  // (when known) a single repository — the auto-commit farm shape. Humans at
  // this volume virtually always review or open PRs somewhere.
  const collab =
    (input.pullRequests ?? 0) + (input.reviews ?? 0) + (input.issues ?? 0);
  const commitsKnown = input.commits !== null && input.commits !== undefined;
  if (commitsKnown && (input.commits ?? 0) >= 5_000 && collab === 0) {
    score += 0.4;
    reasons.push("commit-only-firehose");
    if (input.distinctRepos !== null && input.distinctRepos !== undefined && input.distinctRepos <= 1) {
      score += 0.2;
      reasons.push("single-repo-firehose");
    }
  }

  // Diversity is exculpatory: real review/PR spread cancels weak signals.
  if (collab >= 50) score = Math.max(0, score - 0.25);
  if ((input.distinctRepos ?? 0) >= 5) score = Math.max(0, score - 0.15);

  score = Math.min(1, score);
  return { isBot: score >= 0.7, score, reasons };
}

/* ------------------------------------------------------------------ */
/* Materialized per-window metrics                                     */
/* ------------------------------------------------------------------ */

export type IndexedMetrics = {
  total12m: number;
  total90d: number;
  total30d: number;
  total7d: number;
  activeDays12m: number;
  currentStreak: number;
  longestStreak: number;
  bestDayDate: string | null;
  bestDayCount: number;
  score12m: number;
  score90d: number;
  score30d: number;
  score7d: number;
  momentum30d: number | null;
};

/** Derive every sortable board column from one 365-day calendar. */
export function computeIndexedMetrics(
  calendar: CalendarPayload,
  today: string,
): IndexedMetrics {
  const entry = boardEntryFromCalendar(calendar.profile.login, calendar);
  const byWindow = (w: BoardWindow) => computeWindowStats(entry, w, today);
  const w12 = byWindow("12m");
  const w90 = byWindow("90d");
  const w30 = byWindow("30d");
  const w7 = byWindow("7d");
  return {
    total12m: w12.total,
    total90d: w90.total,
    total30d: w30.total,
    total7d: w7.total,
    activeDays12m: w12.activeDays,
    currentStreak: w12.streak,
    longestStreak: w12.longest,
    bestDayDate: w12.bestDay?.date ?? null,
    bestDayCount: w12.bestDay?.count ?? 0,
    score12m: w12.score.total,
    score90d: w90.score.total,
    score30d: w30.score.total,
    score7d: w7.score.total,
    momentum30d: w30.momentumDelta,
  };
}

/* ------------------------------------------------------------------ */
/* Batched GraphQL hydration                                           */
/* ------------------------------------------------------------------ */

export type GraphqlHydratedUser = {
  profile: GithubProfile & { followers: number | null };
  days: DayCount[];
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
  restricted: number;
  total: number;
};

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Split [fromIso, toIso] into <= chunkDays windows (90-day fallback path). */
export function chunkDateRange(
  fromIso: string,
  toIso: string,
  chunkDays = 90,
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = fromIso;
  while (cursor <= toIso) {
    const endCandidate = (() => {
      const d = new Date(`${cursor}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + chunkDays - 1);
      return d.toISOString().slice(0, 10);
    })();
    const to = endCandidate < toIso ? endCandidate : toIso;
    chunks.push({ from: cursor, to });
    const next = new Date(`${to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return chunks;
}

export function rollingYearRange(today: string): { from: string; to: string } {
  return { from: isoMinusDays(today, 364), to: today };
}

const USER_FIELDS = `
  login name avatarUrl url bio
  followers { totalCount }
  contributionsCollection(from: $from, to: $to) {
    totalCommitContributions
    restrictedContributionsCount
    totalPullRequestContributions
    totalPullRequestReviewContributions
    totalIssueContributions
    contributionCalendar {
      totalContributions
      weeks { contributionDays { date contributionCount } }
    }
  }`;

/**
 * One aliased query for up to ~10 users. Logins are inlined only after the
 * caller validates them against USERNAME_PATTERN, so no escaping is needed;
 * the date range stays parameterized.
 */
export function buildBatchedUserQuery(logins: string[]): string {
  const aliases = logins
    .map((login, i) => `u${i}: user(login: "${login}") { ${USER_FIELDS} }`)
    .join("\n");
  return `query BatchUsers($from: DateTime!, $to: DateTime!) {
    rateLimit { cost remaining resetAt }
    ${aliases}
  }`;
}

export function buildFollowerSweepQuery(): string {
  return `query Sweep($query: String!, $cursor: String) {
    rateLimit { cost remaining resetAt }
    search(type: USER, query: $query, first: 10, after: $cursor) {
      pageInfo { endCursor hasNextPage }
      nodes {
        ... on User {
          login
          followers { totalCount }
          contributionsCollection {
            totalCommitContributions
            contributionCalendar { totalContributions }
          }
        }
      }
    }
  }`;
}

type GqlUserNode = {
  login?: string;
  name?: string | null;
  avatarUrl?: string;
  url?: string;
  bio?: string | null;
  followers?: { totalCount?: number };
  contributionsCollection?: {
    totalCommitContributions?: number;
    restrictedContributionsCount?: number;
    totalPullRequestContributions?: number;
    totalPullRequestReviewContributions?: number;
    totalIssueContributions?: number;
    contributionCalendar?: {
      totalContributions?: number;
      weeks?: Array<{
        contributionDays?: Array<{ date?: string; contributionCount?: number }>;
      }>;
    };
  };
};

export function parseGqlUserNode(node: GqlUserNode | null | undefined): GraphqlHydratedUser | null {
  if (!node?.login) return null;
  const coll = node.contributionsCollection;
  const rawDays: Array<{ date: string; count: number }> = [];
  for (const week of coll?.contributionCalendar?.weeks ?? []) {
    for (const day of week.contributionDays ?? []) {
      if (day.date) rawDays.push({ date: day.date, count: day.contributionCount ?? 0 });
    }
  }
  rawDays.sort((a, b) => a.date.localeCompare(b.date));
  return {
    profile: {
      login: node.login,
      name: node.name ?? null,
      avatarUrl: node.avatarUrl ?? `https://github.com/${node.login}.png?size=96`,
      htmlUrl: node.url ?? `https://github.com/${node.login}`,
      bio: node.bio ?? null,
      followers: node.followers?.totalCount ?? null,
    },
    days: assignLevels(rawDays),
    commits: coll?.totalCommitContributions ?? 0,
    pullRequests: coll?.totalPullRequestContributions ?? 0,
    reviews: coll?.totalPullRequestReviewContributions ?? 0,
    issues: coll?.totalIssueContributions ?? 0,
    restricted: coll?.restrictedContributionsCount ?? 0,
    total:
      coll?.contributionCalendar?.totalContributions ??
      rawDays.reduce((s, d) => s + d.count, 0),
  };
}

/**
 * Parse a batched aliased response. Returns users keyed by lowercase login;
 * aliases that errored or came back null (unknown login, timeout on one
 * heavy account) land in `missing` so the worker can retry them solo.
 */
export function parseBatchedResponse(
  body: unknown,
  logins: string[],
): { users: Map<string, GraphqlHydratedUser>; missing: string[]; rateCost: number | null; rateRemaining: number | null } {
  const users = new Map<string, GraphqlHydratedUser>();
  const missing: string[] = [];
  const data =
    body && typeof body === "object"
      ? ((body as { data?: Record<string, unknown> }).data ?? null)
      : null;
  const rate = data?.rateLimit as { cost?: number; remaining?: number } | undefined;
  logins.forEach((login, i) => {
    const parsed = parseGqlUserNode(data?.[`u${i}`] as GqlUserNode | null);
    if (parsed && parsed.days.length > 0) {
      users.set(parsed.profile.login.toLowerCase(), parsed);
    } else {
      missing.push(login);
    }
  });
  return {
    users,
    missing,
    rateCost: rate?.cost ?? null,
    rateRemaining: rate?.remaining ?? null,
  };
}

/** Follower-sweep page -> candidates ranked by inline yearly total. */
export function parseFollowerSweepPage(body: unknown): {
  candidates: Candidate[];
  endCursor: string | null;
  hasNextPage: boolean;
} {
  const search =
    body && typeof body === "object"
      ? ((body as { data?: { search?: Record<string, unknown> } }).data?.search ?? null)
      : null;
  const pageInfo = (search?.pageInfo ?? {}) as {
    endCursor?: string;
    hasNextPage?: boolean;
  };
  const nodes = Array.isArray(search?.nodes) ? (search!.nodes as GqlUserNode[]) : [];
  const candidates: Candidate[] = [];
  for (const node of nodes) {
    if (!node?.login || isBotLogin(node.login)) continue;
    const total =
      node.contributionsCollection?.contributionCalendar?.totalContributions ?? 0;
    const followers = node.followers?.totalCount ?? 0;
    candidates.push({
      username: node.login,
      source: "followers",
      priority:
        SOURCE_PRIORITY.followers + Math.min(250, Math.round(Math.log10(1 + total) * 60)),
      signals: { followers, total12m: total },
    });
  }
  return {
    candidates,
    endCursor: pageInfo.endCursor ?? null,
    hasNextPage: Boolean(pageInfo.hasNextPage),
  };
}

/** Merge 90-day chunk payloads for one user into a single hydrated user. */
export function mergeHydratedChunks(
  chunks: GraphqlHydratedUser[],
): GraphqlHydratedUser | null {
  const first = chunks[0];
  if (!first) return null;
  const byDate = new Map<string, number>();
  for (const chunk of chunks) {
    for (const day of chunk.days) byDate.set(day.date, day.count);
  }
  const days = assignLevels(
    [...byDate.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
  const sum = (pick: (c: GraphqlHydratedUser) => number) =>
    chunks.reduce((s, c) => s + pick(c), 0);
  return {
    profile: first.profile,
    days,
    commits: sum((c) => c.commits),
    pullRequests: sum((c) => c.pullRequests),
    reviews: sum((c) => c.reviews),
    issues: sum((c) => c.issues),
    restricted: sum((c) => c.restricted),
    total: days.reduce((s, d) => s + d.count, 0),
  };
}

/** Convert a hydrated GraphQL user into the stored CalendarPayload shape. */
export function hydratedToCalendar(
  user: GraphqlHydratedUser,
  today: string,
): CalendarPayload {
  const days = user.days.filter((d) => d.date <= today);
  const stats = computeStats(days, today);
  return {
    username: user.profile.login,
    profile: {
      login: user.profile.login,
      name: user.profile.name,
      avatarUrl: user.profile.avatarUrl,
      htmlUrl: user.profile.htmlUrl,
      bio: user.profile.bio,
    },
    range: {
      from: days[0]?.date ?? today,
      to: days[days.length - 1]?.date ?? today,
    },
    days,
    stats: { ...stats, priorTotal: null, priorPeriodLabel: null },
  };
}
