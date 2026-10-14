import { assignLevels, computeStats } from "./stats";
import {
  parseMergedPulls,
  mergedPullQueries,
  searchPageCount,
  SEARCH_CAP,
  SEARCH_PAGE,
  type SearchPullItem,
} from "./pulls";
import { parseContributionHtml, parseJogruber } from "./parse";
import type {
  ActivitySplit,
  CalendarPayload,
  DayCommit,
  DayCommitsPayload,
  GithubFnError,
  GithubProfile,
  LanguageMixItem,
} from "./types";

const UA = "CadenceDashboard/1.0";
const CACHE_TTL_MS = 8 * 60 * 1000;
const CACHE_MAX = 240;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Promise.resolve(hit.value as T);
  }
  return load().then((value) => {
    cache.set(key, { at: Date.now(), value });
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return value;
  });
}

function error(code: GithubFnError["code"], message: string): GithubFnError {
  return { error: message, code };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": UA,
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubJson<T>(
  url: string,
): Promise<{ status: number; body: T | null }> {
  const res = await fetch(url, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 204) return { status: res.status, body: null };
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as T };
  } catch {
    return { status: res.status, body: null };
  }
}

type GithubUser = {
  login?: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
  bio?: string | null;
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

export async function fetchCalendar(input: {
  username: string;
  year?: number;
  today: string;
}): Promise<CalendarPayload | GithubFnError> {
  try {
    const username = input.username;
    const year = input.year;
    const cacheKey = `cal:${username}:${year ?? "rolling"}:${input.today}`;
    return await cached(cacheKey, async () => {
      const profileRes = await githubJson<GithubUser>(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
      );
      if (profileRes.status === 404) {
        return error("not_found", `No GitHub user named ${username}`);
      }

      const user = profileRes.body;
      const profile: GithubProfile =
        profileRes.status < 400 && user?.login
          ? {
              login: user.login,
              name: user.name ?? null,
              avatarUrl: user.avatar_url ?? stubProfile(user.login).avatarUrl,
              htmlUrl: user.html_url ?? `https://github.com/${user.login}`,
              bio: user.bio ?? null,
            }
          : stubProfile(username);

      let from: string;
      let to: string;
      if (year) {
        from = `${year}-01-01`;
        to =
          year === Number(input.today.slice(0, 4))
            ? input.today
            : `${year}-12-31`;
      } else {
        const end = new Date(`${input.today}T00:00:00Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 364);
        from = start.toISOString().slice(0, 10);
        to = input.today;
      }

      const days = await loadDays(profile.login, from, to, year);
      const clipped = assignLevels(days.filter((d) => d.date <= input.today));
      if (clipped.length === 0) {
        if (profileRes.status === 403 || profileRes.status === 429) {
          return error(
            "rate_limit",
            "GitHub is rate-limiting lookups. Try again in a minute.",
          );
        }
        return error("unavailable", "Could not load the contribution calendar.");
      }

      return {
        username: profile.login,
        profile,
        range: { from: clipped[0]!.date, to: clipped[clipped.length - 1]!.date },
        days: clipped,
        stats: computeStats(clipped, input.today),
      } satisfies CalendarPayload;
    });
  } catch {
    return error("unavailable", "Could not load the contribution calendar.");
  }
}

async function loadDays(
  login: string,
  from: string,
  to: string,
  year?: number,
) {
  const contribUrl = year
    ? `https://github.com/users/${encodeURIComponent(login)}/contributions?from=${from}&to=${to}`
    : `https://github.com/users/${encodeURIComponent(login)}/contributions`;
  try {
    const res = await fetch(contribUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
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

  const mirrorUrl = year
    ? `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=${year}`
    : `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}`;
  const res = await fetch(mirrorUrl, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    contributions?: Array<{ date?: string; count?: number; level?: number }>;
  };
  return parseJogruber(json).filter((d) => d.date >= from && d.date <= to);
}

type SearchCommit = {
  sha?: string;
  html_url?: string;
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
  const pages = searchPageCount(total);
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

export async function fetchDayCommits(input: {
  username: string;
  date: string;
}): Promise<DayCommitsPayload | GithubFnError> {
  const { username, date } = input;
  try {
    return await cached(`day:v4:${username}:${date}`, async () => {
      const queries = mergedPullQueries(username, date);
      const [commitsRes, openedRes, mergedRes] = await Promise.all([
        searchPages<SearchCommit>(
          (page) =>
            commitSearchUrl(`author:${username} author-date:${date}`, page),
        ),
        searchPages<SearchPullItem>((page) =>
          issueSearchUrl(queries.opened, page),
        ),
        searchPages<SearchPullItem>((page) =>
          issueSearchUrl(queries.merged, page),
        ),
      ]);

      const commitsLimited =
        commitsRes.status === 403 || commitsRes.status === 429;
      const commitsFailed =
        commitsRes.status >= 400 && commitsRes.status !== 422;
      const commits: DayCommit[] = [];
      const seen = new Set<string>();
      for (const item of commitsRes.items) {
        const sha = item.sha ?? "";
        if (!sha || seen.has(sha)) continue;
        seen.add(sha);
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
          repo: repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : "repository",
          authoredAt: item.commit?.author?.date ?? `${date}T00:00:00Z`,
          authorName: item.commit?.author?.name ?? username,
        });
      }

      const mergedLimited =
        openedRes.status === 403 ||
        openedRes.status === 429 ||
        mergedRes.status === 403 ||
        mergedRes.status === 429;
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
      const bothComplete =
        openedRes.status < 400 &&
        mergedRes.status < 400 &&
        openedRes.items.length >= Math.min(openedTotal, SEARCH_CAP) &&
        mergedRes.items.length >= Math.min(mergedByTotal, SEARCH_CAP);

      return {
        date,
        total: commitsFailed ? 0 : commitsRes.total,
        incomplete: commitsRes.incomplete,
        commits,
        commitsError: commitsLimited
          ? "GitHub commit search is rate-limited. The heatmap still works."
          : commitsFailed
            ? "Could not load public commits for that day."
            : undefined,
        mergedTotal: bothComplete ? merged.length : openedTotal + mergedByTotal,
        mergedIncomplete:
          !bothComplete || openedRes.incomplete || mergedRes.incomplete,
        merged,
        mergedError: mergedLimited
          ? "GitHub PR search is rate-limited."
          : mergedFailed
            ? "Could not load merged pull requests for that day."
            : undefined,
      };
    });
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
  try {
    return await cached(`lang:${username}`, async () => {
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
  try {
    return await cached(`split:${username}:${from}:${to}`, async () => {
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

