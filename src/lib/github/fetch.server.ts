import { assignLevels, computeStats } from "./stats";
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

export async function fetchDayCommits(input: {
  username: string;
  date: string;
}): Promise<DayCommitsPayload | GithubFnError> {
  const { username, date } = input;
  try {
    return await cached(`day:${username}:${date}`, async () => {
      const query = `author:${username} author-date:${date}`;
      const url = `https://api.github.com/search/commits?q=${encodeURIComponent(query)}&sort=author-date&order=desc&per_page=100`;
      const res = await githubJson<SearchResponse>(url);
      if (res.status === 403 || res.status === 429) {
        return error(
          "rate_limit",
          "GitHub commit search is rate-limited. The heatmap still works.",
        );
      }
      if (res.status === 422) {
        return { date, total: 0, incomplete: false, commits: [] };
      }
      if (res.status >= 400 || !res.body) {
        return error(
          "unavailable",
          "Could not load public commits for that day.",
        );
      }

      const items = res.body.items ?? [];
      const commits: DayCommit[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const sha = item.sha ?? "";
        if (!sha || seen.has(sha)) continue;
        seen.add(sha);
        const htmlUrl = item.html_url ?? "";
        const repoMatch = htmlUrl.match(
          /github\.com\/([^/]+)\/([^/]+)\/commit\//,
        );
        const message = (item.commit?.message ?? "").split("\n")[0]?.trim() ?? "";
        commits.push({
          sha: sha.slice(0, 7),
          message: message.slice(0, 160) || "Commit",
          htmlUrl,
          repo: repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : "repository",
          authoredAt: item.commit?.author?.date ?? `${date}T00:00:00Z`,
          authorName: item.commit?.author?.name ?? username,
        });
      }

      return {
        date,
        total: res.body.total_count ?? commits.length,
        incomplete: Boolean(res.body.incomplete_results),
        commits,
      };
    });
  } catch {
    return error("unavailable", "Could not load public commits for that day.");
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

