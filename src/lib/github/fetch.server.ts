import { execFileSync } from "node:child_process";
import { assignLevels, computeStats } from "./stats";
import { countCommits } from "./commits";
import {
  parseMergedPulls,
  mergedPullQueries,
  searchPageCount,
  SEARCH_CAP,
  SEARCH_PAGE,
  type SearchPullItem,
} from "./pulls";
import { parseContributionHtml, parseJogruber } from "./parse";
import { isValidIsoDate } from "./username";
import type {
  ActivitySplit,
  CalendarPayload,
  DayCommit,
  DayCommitsPayload,
  DayPull,
  GithubFnError,
  GithubProfile,
  LanguageMixItem,
} from "./types";

const UA = "CadenceDashboard/1.0";
const CACHE_TTL_MS = 8 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 15 * 1000;
const CACHE_MAX = 240;
const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const staleCalendarCache = new Map<
  string,
  { at: number; value: CalendarPayload }
>();

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, max = CACHE_MAX) {
  map.delete(key);
  map.set(key, value);
  if (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}

function isTransientErrorValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as {
    code?: unknown;
    commitsError?: unknown;
    mergedError?: unknown;
  };
  if (obj.code === "rate_limit" || obj.code === "unavailable") return true;
  if (typeof obj.commitsError === "string" || typeof obj.mergedError === "string") {
    return true;
  }
  return false;
}

function cached<T>(
  key: string,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return Promise.resolve(hit.value as T);
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }
  const promise = load()
    .then((value) => {
      if (!keep(value)) return value;
      const ttl = isTransientErrorValue(value)
        ? ERROR_CACHE_TTL_MS
        : CACHE_TTL_MS;
      setBoundedMap(cache, key, { at: Date.now(), ttl, value }, CACHE_MAX);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

function error(
  code: GithubFnError["code"],
  message: string,
  stale?: { at: number; value: CalendarPayload },
): GithubFnError {
  return {
    error: message,
    code,
    ...(stale
      ? { staleCalendar: stale.value, staleUpdatedAt: stale.at }
      : {}),
  };
}

let resolvedToken: string | null | undefined;

function githubToken(): string | undefined {
  if (resolvedToken !== undefined) return resolvedToken ?? undefined;
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (env?.trim()) {
    resolvedToken = env.trim();
    return resolvedToken;
  }
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    resolvedToken = token || null;
  } catch {
    resolvedToken = null;
  }
  return resolvedToken ?? undefined;
}

function githubHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": UA,
  };
  if (includeAuth) {
    const token = githubToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubJson<T>(
  url: string,
): Promise<{ status: number; body: T | null }> {
  try {
    let res = await fetch(url, {
      headers: githubHeaders(true),
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 401 && resolvedToken) {
      resolvedToken = null;
      res = await fetch(url, {
        headers: githubHeaders(false),
        signal: AbortSignal.timeout(12000),
      });
    }
    if (res.status === 204) return { status: res.status, body: null };
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) as T };
    } catch {
      return { status: res.status, body: null };
    }
  } catch {
    return { status: 503, body: null };
  }
}

/** True when a GitHub token is resolvable (env or `gh auth`). */
export function hasGithubToken(): boolean {
  return Boolean(githubToken());
}

/**
 * Shared GraphQL POST for server callers (leaderboard indexer). Returns the
 * parsed body even on partial GraphQL errors — batched queries rely on
 * per-alias data surviving a sibling timeout. Null only on transport failure
 * or a non-2xx without a usable body.
 */
export async function githubGraphql(
  query: string,
  variables: Record<string, unknown>,
  timeoutMs = 25_000,
): Promise<{ status: number; body: unknown }> {
  const post = (includeAuth: boolean) =>
    fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...githubHeaders(includeAuth), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  try {
    let res = await post(true);
    if (res.status === 401 && resolvedToken) {
      resolvedToken = null;
      res = await post(false);
    }
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) as unknown };
    } catch {
      return { status: res.status, body: null };
    }
  } catch {
    return { status: 503, body: null };
  }
}

type GithubUser = {
  login?: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
  bio?: string | null;
  type?: string;
  message?: string;
};

function stubProfile(username: string): GithubProfile {
  return {
    login: username,
    name: null,
    avatarUrl: `https://github.com/${username}.png?size=96`,
    htmlUrl: `https://github.com/${username}`,
    bio: null,
  };
}

export function getCachedCalendar(input: {
  username: string;
  year?: number;
  today: string;
}): CalendarPayload | null {
  const lower = input.username.trim().toLowerCase();
  const cacheKey = `cal:v5:${lower}:${input.year ?? "rolling"}:${input.today}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < hit.ttl) {
    const val = hit.value as CalendarPayload | GithubFnError;
    if (val && !("error" in val)) return val;
  }
  const stale = staleCalendarCache.get(`${lower}:${input.year ?? "rolling"}`);
  if (
    stale &&
    Date.now() - stale.at < CACHE_TTL_MS &&
    (input.year ? true : stale.value.range.to === input.today)
  ) {
    return stale.value;
  }
  return null;
}

async function probePublicGithubAccountKind(
  username: string,
): Promise<"user" | "org" | "not_found" | "unknown"> {
  try {
    const res = await fetch(
      `https://github.com/${encodeURIComponent(username)}`,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) return "not_found";
    if (!res.ok) return "unknown";
    const html = await res.text();
    if (
      html.includes('content="organization:') ||
      html.includes('itemtype="http://schema.org/Organization"')
    ) {
      return "org";
    }
    return "user";
  } catch {
    return "unknown";
  }
}

export async function fetchCalendar(input: {
  username: string;
  year?: number;
  today: string;
}): Promise<CalendarPayload | GithubFnError> {
  const username = input.username.trim();
  const lower = username.toLowerCase();
  if (!isValidIsoDate(input.today)) {
    return error("unavailable", "Invalid calendar date.");
  }
  const todayYear = Number(input.today.slice(0, 4));
  const year =
    input.year !== undefined ? Math.min(input.year, todayYear) : undefined;
  const staleKey = `${lower}:${year ?? "rolling"}`;
  try {
    const cacheKey = `cal:v5:${lower}:${year ?? "rolling"}:${input.today}`;
    return await cached(cacheKey, async () => {
      const profileRes = await cached(
        `user:v1:${lower}`,
        () =>
          githubJson<GithubUser>(
            `https://api.github.com/users/${encodeURIComponent(username)}`,
          ),
        (res) => res.status < 400 || res.status === 404,
      );
      if (profileRes.status === 404) {
        return error("not_found", `No GitHub user named "${username}"`);
      }

      const user = profileRes.body;
      if (
        profileRes.status < 400 &&
        user?.type &&
        user.type.toLowerCase() === "organization"
      ) {
        return error(
          "organization",
          `@${user.login ?? username} is an organization account. Contribution graphs are only available for user accounts.`,
        );
      }

      const previousProfile =
        staleCalendarCache.get(staleKey)?.value.profile ??
        staleCalendarCache.get(`${lower}:rolling`)?.value.profile;

      const profile: GithubProfile =
        profileRes.status < 400 && user?.login
          ? {
              login: user.login,
              name: user.name ?? null,
              avatarUrl: user.avatar_url ?? stubProfile(user.login).avatarUrl,
              htmlUrl: user.html_url ?? `https://github.com/${user.login}`,
              bio: user.bio ?? null,
            }
          : (previousProfile ?? stubProfile(username));

      const earliestYear = todayYear - 2;

      let from: string;
      let to: string;
      let priorFrom: string | null = null;
      let priorTo: string | null = null;
      let priorPeriodLabel: string | null = null;

      if (year) {
        from = `${year}-01-01`;
        to = year === todayYear ? input.today : `${year}-12-31`;
        if (year > earliestYear) {
          priorFrom = `${year - 1}-01-01`;
          if (year < todayYear) {
            priorTo = `${year - 1}-12-31`;
            priorPeriodLabel = "prior 12 months";
          } else {
            const daySpan = Math.max(
              0,
              Math.round(
                (Date.parse(`${to}T00:00:00Z`) -
                  Date.parse(`${from}T00:00:00Z`)) /
                  86_400_000,
              ),
            );
            const priorEnd = new Date(`${priorFrom}T00:00:00Z`);
            priorEnd.setUTCDate(priorEnd.getUTCDate() + daySpan);
            priorTo = priorEnd.toISOString().slice(0, 10);
            priorPeriodLabel = "prior year";
          }
        }
      } else {
        const end = new Date(`${input.today}T00:00:00Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 364);
        from = start.toISOString().slice(0, 10);
        to = input.today;

        const pEnd = new Date(start);
        pEnd.setUTCDate(pEnd.getUTCDate() - 1);
        const pStart = new Date(pEnd);
        pStart.setUTCDate(pStart.getUTCDate() - 364);
        priorFrom = pStart.toISOString().slice(0, 10);
        priorTo = pEnd.toISOString().slice(0, 10);
        priorPeriodLabel = "prior 12 months";
      }

      const [days, rawPriorTotal] = await Promise.all([
        loadDays(profile.login, from, to, year),
        priorFrom && priorTo
          ? loadPriorTotal(profile.login, priorFrom, priorTo)
          : Promise.resolve(null),
      ]);

      const clipped = assignLevels(days.filter((d) => d.date <= input.today));
      if (clipped.length === 0) {
        const kind = await probePublicGithubAccountKind(username);
        if (kind === "not_found") {
          return error("not_found", `No GitHub user named "${username}"`);
        }
        if (kind === "org") {
          return error(
            "organization",
            `@${username} is an organization account. Contribution graphs are only available for user accounts.`,
          );
        }
        const stale = staleCalendarCache.get(staleKey);
        if (profileRes.status === 403 || profileRes.status === 429) {
          return error(
            "rate_limit",
            "GitHub is rate-limiting lookups. Try again in a minute.",
            stale,
          );
        }
        return error(
          "unavailable",
          "Could not load the contribution calendar.",
          stale,
        );
      }

      const rangeFrom = clipped[0]!.date;
      const rangeTo = clipped[clipped.length - 1]!.date;
      const isPastRange = Boolean(year && year < todayYear);
      const baseStats = computeStats(clipped, rangeTo, !isPastRange);
      const priorTotal =
        rawPriorTotal !== null && rawPriorTotal >= 0 ? rawPriorTotal : null;

      const payload: CalendarPayload = {
        username: profile.login,
        profile,
        range: { from: rangeFrom, to: rangeTo },
        days: clipped,
        stats: {
          ...baseStats,
          priorTotal,
          priorPeriodLabel: priorTotal !== null ? priorPeriodLabel : null,
        },
      };
      setBoundedMap(
        staleCalendarCache,
        staleKey,
        { at: Date.now(), value: payload },
        CACHE_MAX,
      );
      return payload;
    });
  } catch {
    return error(
      "unavailable",
      "Could not load the contribution calendar.",
      staleCalendarCache.get(staleKey),
    );
  }
}

async function loadYearDays(login: string, y: number) {
  return cached(
    `yeardays:v1:${login.toLowerCase()}:${y}`,
    async () => {
      const from = `${y}-01-01`;
      const to = `${y}-12-31`;
      const contribUrl = `https://github.com/users/${encodeURIComponent(login)}/contributions?from=${from}&to=${to}`;
      try {
        const res = await fetch(contribUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const html = await res.text();
          const parsed = parseContributionHtml(html).filter(
            (d) => d.date >= from && d.date <= to,
          );
          if (parsed.length > 0) return parsed;
        }
      } catch {
        // fall through to JSON mirror
      }

      try {
        const mirrorUrl = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=${y}`;
        const res = await fetch(mirrorUrl, {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          contributions?: Array<{
            date?: string;
            count?: number;
            level?: number;
          }>;
        };
        return parseJogruber(json).filter(
          (d) => d.date >= from && d.date <= to,
        );
      } catch {
        return [];
      }
    },
    (days) => days.length > 0,
  );
}

async function loadPriorTotal(
  login: string,
  from: string,
  to: string,
): Promise<number | null> {
  const yStart = Number(from.slice(0, 4));
  const yEnd = Number(to.slice(0, 4));

  try {
    const yearsToFetch = yStart === yEnd ? [yStart] : [yStart, yEnd];
    const results = await Promise.all(
      yearsToFetch.map((y) => loadYearDays(login, y)),
    );
    const flat = results
      .flat()
      .filter((d) => d.date >= from && d.date <= to);
    if (flat.length > 0) {
      return flat.reduce((sum, d) => sum + d.count, 0);
    }
  } catch {
    // ignore
  }

  return null;
}

async function loadDays(
  login: string,
  from: string,
  to: string,
  year?: number,
) {
  if (year) {
    const yearDays = await loadYearDays(login, year);
    return yearDays.filter((d) => d.date >= from && d.date <= to);
  }

  const contribUrl = `https://github.com/users/${encodeURIComponent(login)}/contributions`;
  try {
    const res = await fetch(contribUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      const parsed = parseContributionHtml(html).filter(
        (d) => d.date >= from && d.date <= to,
      );
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to the public JSON mirror
  }

  try {
    const mirrorUrl = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=last`;
    const res = await fetch(mirrorUrl, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      contributions?: Array<{ date?: string; count?: number; level?: number }>;
    };
    return parseJogruber(json).filter((d) => d.date >= from && d.date <= to);
  } catch {
    return [];
  }
}


type SearchCommit = {
  sha?: string;
  html_url?: string;
  repository?: { private?: boolean; full_name?: string };
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
};

type SearchResponse = {
  total_count?: number;
  incomplete_results?: boolean;
  items?: SearchCommit[];
  message?: string;
};

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

async function searchPages<T>(
  urlForPage: (page: number) => string,
  maxPages = 1,
): Promise<{
  status: number;
  total: number;
  incomplete: boolean;
  items: T[];
}> {
  const first = await githubJson<{
    total_count?: number;
    incomplete_results?: boolean;
    items?: T[];
  }>(urlForPage(1));
  if (first.status >= 400 || !first.body) {
    return { status: first.status, total: 0, incomplete: false, items: [] };
  }
  const total = first.body.total_count ?? first.body.items?.length ?? 0;
  const pages = Math.min(searchPageCount(total), maxPages);
  const items = [...(first.body.items ?? [])];
  if (pages > 1) {
    const rest = await mapPool(
      Array.from({ length: pages - 1 }, (_, index) => index + 2),
      4,
      (page) =>
        githubJson<{ items?: T[] }>(urlForPage(page)),
    );
    for (const page of rest) {
      if (page.body?.items) items.push(...page.body.items);
    }
  }
  return {
    status: first.status,
    total,
    incomplete: Boolean(first.body.incomplete_results) || total > SEARCH_CAP,
    items: items.slice(0, SEARCH_CAP),
  };
}

function commitSearchUrl(query: string, page: number): string {
  return `https://api.github.com/search/commits?q=${encodeURIComponent(query)}&sort=author-date&order=desc&per_page=${SEARCH_PAGE}&page=${page}`;
}

function issueSearchUrl(query: string, page: number): string {
  return `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${SEARCH_PAGE}&page=${page}`;
}

type GraphqlPullNode = {
  url?: string;
  number?: number;
  title?: string;
  mergedAt?: string | null;
  author?: { login?: string } | null;
  repository?: { isPrivate?: boolean; nameWithOwner?: string };
};

type GraphqlDayPullsResponse = {
  data?: {
    mergedAuthor?: { issueCount?: number; nodes?: Array<GraphqlPullNode | null> };
    mergedBy?: { issueCount?: number; nodes?: Array<GraphqlPullNode | null> };
    createdAll?: { issueCount?: number };
  };
};

async function fetchDayPullsGraphql(
  username: string,
  date: string,
): Promise<{
  mergedTotal: number;
  mergedPublicTotal: number;
  mergedPrivateTotal: number;
  openedPrsTotal: number;
  incomplete: boolean;
  merged: DayPull[];
} | null> {
  const token = githubToken();
  if (!token) return null;
  const queries = mergedPullQueries(username, date);
  const query = `
    query($mergedAuthor: String!, $mergedBy: String!, $createdAll: String!) {
      mergedAuthor: search(query: $mergedAuthor, type: ISSUE, first: 100) {
        issueCount
        nodes {
          ... on PullRequest {
            url
            number
            title
            mergedAt
            author { login }
            repository { isPrivate nameWithOwner }
          }
        }
      }
      mergedBy: search(query: $mergedBy, type: ISSUE, first: 100) {
        issueCount
        nodes {
          ... on PullRequest {
            url
            number
            title
            mergedAt
            author { login }
            repository { isPrivate nameWithOwner }
          }
        }
      }
      createdAll: search(query: $createdAll, type: ISSUE, first: 1) {
        issueCount
      }
    }
  `;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        ...githubHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          mergedAuthor: queries.opened,
          mergedBy: queries.merged,
          createdAll: queries.created,
        },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 401 && resolvedToken) {
      resolvedToken = null;
    }
    if (!res.ok) return null;
    const body = (await res.json()) as GraphqlDayPullsResponse;
    if (!body.data?.mergedAuthor || !body.data?.mergedBy || !body.data?.createdAll) {
      return null;
    }
    const seen = new Map<string, GraphqlPullNode>();
    for (const node of [
      ...(body.data.mergedAuthor.nodes ?? []),
      ...(body.data.mergedBy.nodes ?? []),
    ]) {
      if (node?.url && !seen.has(node.url)) seen.set(node.url, node);
    }
    let pubSeen = 0;
    let privSeen = 0;
    for (const node of seen.values()) {
      if (node.repository?.isPrivate) privSeen += 1;
      else pubSeen += 1;
    }
    const authorCount = body.data.mergedAuthor.issueCount ?? 0;
    const mergedByCount = body.data.mergedBy.issueCount ?? 0;
    const bothComplete =
      authorCount <= SEARCH_PAGE && mergedByCount <= SEARCH_PAGE;
    const reportedTotal = bothComplete
      ? seen.size
      : Math.max(seen.size, authorCount, mergedByCount);
    const counted = countCommits({
      reportedTotal,
      publicSeen: pubSeen,
      privateSeen: privSeen,
    });
    const merged: DayPull[] = [];
    const login = username.toLowerCase();
    for (const [url, node] of seen) {
      if (node.repository?.isPrivate) continue;
      const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      const author = node.author?.login ?? "";
      merged.push({
        number: node.number ?? Number(repoMatch?.[3] ?? 0),
        title: (node.title ?? "Pull request").slice(0, 160),
        htmlUrl: url,
        repo:
          node.repository?.nameWithOwner ??
          (repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : "repository"),
        mergedAt: node.mergedAt ?? `${date}T00:00:00Z`,
        role: author.toLowerCase() === login ? "opened" : "merged",
      });
    }
    return {
      mergedTotal: counted.total,
      mergedPublicTotal: counted.publicTotal,
      mergedPrivateTotal: counted.privateTotal,
      openedPrsTotal: body.data.createdAll.issueCount ?? 0,
      incomplete: !bothComplete,
      merged,
    };
  } catch {
    return null;
  }
}

export async function fetchDayCommits(input: {
  username: string;
  date: string;
}): Promise<DayCommitsPayload | GithubFnError> {
  const { username, date } = input;
  const lower = username.toLowerCase();
  try {
    return await cached(
      `day:v11:${lower}:${date}`,
      async () => {
        const queries = mergedPullQueries(username, date);
        const [commitsRes, gqlPulls] = await Promise.all([
          searchPages<SearchCommit>((page) =>
            commitSearchUrl(`author:${username} author-date:${date}`, page),
          ),
          fetchDayPullsGraphql(username, date),
        ]);

        const commitsLimited =
          commitsRes.status === 403 || commitsRes.status === 429;
        const commitsFailed =
          commitsRes.status >= 400 && commitsRes.status !== 422;
        const commits: DayCommit[] = [];
        const seen = new Set<string>();
        let publicSeen = 0;
        let privateSeen = 0;
        for (const item of commitsRes.items) {
          const sha = item.sha ?? "";
          if (!sha || seen.has(sha)) continue;
          seen.add(sha);
          if (item.repository?.private) {
            privateSeen += 1;
            continue;
          }
          publicSeen += 1;
          const htmlUrl = item.html_url ?? "";
          const repoMatch = htmlUrl.match(
            /github\.com\/([^/]+)\/([^/]+)\/commit\//,
          );
          const message =
            (item.commit?.message ?? "").split("\n")[0]?.trim() ?? "";
          commits.push({
            sha: sha.slice(0, 7),
            message: message.slice(0, 160) || "Commit",
            htmlUrl,
            repo:
              item.repository?.full_name ??
              (repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : "repository"),
            authoredAt: item.commit?.author?.date ?? `${date}T00:00:00Z`,
            authorName: item.commit?.author?.name ?? username,
          });
        }
        const counted = countCommits({
          reportedTotal: commitsFailed ? 0 : commitsRes.total,
          publicSeen,
          privateSeen,
        });

        if (gqlPulls) {
          return {
            date,
            total: counted.total,
            publicTotal: counted.publicTotal,
            privateTotal: counted.privateTotal,
            incomplete: commitsRes.incomplete,
            commits,
            commitsError: commitsLimited
              ? "GitHub commit search is rate-limited. The heatmap still works."
              : commitsFailed
                ? "Could not load public commits for that day."
                : undefined,
            mergedTotal: gqlPulls.mergedTotal,
            mergedPublicTotal: gqlPulls.mergedPublicTotal,
            mergedPrivateTotal: gqlPulls.mergedPrivateTotal,
            openedPrsTotal: gqlPulls.openedPrsTotal,
            mergedIncomplete: gqlPulls.incomplete,
            merged: gqlPulls.merged,
          };
        }

        const [openedRes, mergedRes, createdRes] = await Promise.all([
          searchPages<SearchPullItem>((page) =>
            issueSearchUrl(queries.opened, page),
          ),
          searchPages<SearchPullItem>((page) =>
            issueSearchUrl(queries.merged, page),
          ),
          searchPages<SearchPullItem>((page) =>
            issueSearchUrl(queries.created, page),
          ),
        ]);

        const mergedLimited =
          openedRes.status === 403 ||
          openedRes.status === 429 ||
          mergedRes.status === 403 ||
          mergedRes.status === 429 ||
          createdRes.status === 403 ||
          createdRes.status === 429;
        const mergedFailed =
          openedRes.status >= 400 &&
          openedRes.status !== 422 &&
          mergedRes.status >= 400 &&
          mergedRes.status !== 422;
        const merged = parseMergedPulls(
          username,
          [...openedRes.items, ...mergedRes.items],
          date,
        );
        const openedTotal = openedRes.status < 400 ? openedRes.total : 0;
        const mergedByTotal = mergedRes.status < 400 ? mergedRes.total : 0;
        const createdTotal = createdRes.status < 400 ? createdRes.total : 0;
        const bothComplete =
          openedRes.status < 400 &&
          mergedRes.status < 400 &&
          openedTotal <= SEARCH_PAGE &&
          mergedByTotal <= SEARCH_PAGE &&
          openedRes.items.length >= openedTotal &&
          mergedRes.items.length >= mergedByTotal;
        const mergedTotal = bothComplete
          ? merged.length
          : Math.max(merged.length, openedTotal, mergedByTotal);

        return {
          date,
          total: counted.total,
          publicTotal: counted.publicTotal,
          privateTotal: counted.privateTotal,
          incomplete: commitsRes.incomplete,
          commits,
          commitsError: commitsLimited
            ? "GitHub commit search is rate-limited. The heatmap still works."
            : commitsFailed
              ? "Could not load public commits for that day."
              : undefined,
          mergedTotal,
          mergedPublicTotal: mergedTotal,
          mergedPrivateTotal: 0,
          openedPrsTotal: createdTotal,
          mergedIncomplete:
            !bothComplete || openedRes.incomplete || mergedRes.incomplete,
          merged,
          mergedError: mergedLimited
            ? "GitHub PR search is rate-limited."
            : mergedFailed
              ? "Could not load merged pull requests for that day."
              : undefined,
        };
      },
      (value) =>
        !value.commitsError?.includes("rate-limited") &&
        !value.mergedError?.includes("rate-limited"),
    );
  } catch {
    return error("unavailable", "Could not load that day from GitHub.");
  }
}

type GithubRepo = {
  fork?: boolean;
  language?: string | null;
};

export async function fetchLanguageMix(
  username: string,
): Promise<{ items: LanguageMixItem[] } | GithubFnError> {
  const lower = username.toLowerCase();
  try {
    return await cached(`lang:${lower}`, async () => {
      const res = await githubJson<GithubRepo[]>(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=pushed&type=owner`,
      );
      if (res.status === 404) {
        return error("not_found", `No GitHub user named ${username}`);
      }
      if (res.status === 403 || res.status === 429) {
        return error(
          "rate_limit",
          "GitHub is rate-limiting language lookups.",
        );
      }
      if (res.status >= 400 || !Array.isArray(res.body)) {
        return error("unavailable", "Could not load public repositories.");
      }
      const counts = new Map<string, number>();
      for (const repo of res.body) {
        if (repo.fork) continue;
        const language = repo.language?.trim();
        if (!language) continue;
        counts.set(language, (counts.get(language) ?? 0) + 1);
      }
      const items = [...counts.entries()]
        .map(([language, repos]) => ({ language, repos }))
        .sort((a, b) => b.repos - a.repos || a.language.localeCompare(b.language));
      return { items };
    });
  } catch {
    return error("unavailable", "Could not load public repositories.");
  }
}

export async function fetchActivitySplit(input: {
  username: string;
  from: string;
  to: string;
}): Promise<ActivitySplit | GithubFnError> {
  const { username, from, to } = input;
  const lower = username.toLowerCase();
  try {
    return await cached(`split:${lower}:${from}:${to}`, async () => {
      const commitQ = `author:${username} author-date:${from}..${to}`;
      const prQ = `author:${username} type:pr created:${from}..${to}`;
      const [commits, prs] = await Promise.all([
        githubJson<SearchResponse>(
          `https://api.github.com/search/commits?q=${encodeURIComponent(commitQ)}&per_page=1`,
        ),
        githubJson<SearchResponse>(
          `https://api.github.com/search/issues?q=${encodeURIComponent(prQ)}&per_page=1`,
        ),
      ]);
      if (commits.status === 403 || commits.status === 429 || prs.status === 403 || prs.status === 429) {
        return error(
          "rate_limit",
          "GitHub search is rate-limited. Recap still shows the calendar.",
        );
      }
      if (commits.status >= 400 && prs.status >= 400) {
        return error("unavailable", "Could not load public PR and commit totals.");
      }
      return {
        commits: commits.body?.total_count ?? 0,
        pullRequests: prs.body?.total_count ?? 0,
      };
    });
  } catch {
    return error("unavailable", "Could not load public PR and commit totals.");
  }
}

