import crypto from "node:crypto";
import { USERNAME_PATTERN } from "./username";

const TREG_BASE_URL = process.env.TREG_BASE_URL || "https://treg.to";

export type TrendingDeveloperItem = {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  repoName: string | null;
  repoDescription: string | null;
};

export type TrendingDevelopersResult = {
  ok: true;
  source: "treg" | "github-trending";
  language: string;
  since: "daily" | "weekly" | "monthly";
  developers: TrendingDeveloperItem[];
  tregCallId: string | null;
  costMicro: number;
};

export type TrendingRepositoryItem = {
  owner: string;
  repoName: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  starsToday: number;
};

export type TrendingRepositoriesResult = {
  ok: true;
  source: "treg-crawl4ai" | "treg-scrapecreators" | "github-trending";
  language: string;
  since: "daily" | "weekly" | "monthly";
  repositories: TrendingRepositoryItem[];
  tregCallId: string | null;
  costMicro: number;
};

export type BuilderRepoItem = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string | null;
};

export type BuilderPortfolioResult = {
  ok: true;
  username: string;
  source: "treg" | "github-api" | "github-profile";
  topLanguages: { language: string; count: number; stars: number }[];
  totalStars: number;
  repos: BuilderRepoItem[];
  tregCallId: string | null;
  costMicro: number;
};

/**
 * Canonical treg.to relay helper following https://treg.to/integrate.md:
 * - Sends X-Treg-Token and X-Treg-Meta (up to 5 key=value tags)
 * - Caps per-call spend with X-Treg-Route-Max-Cost
 * - Sends Idempotency-Key for safe retries
 * - Extracts X-Treg-Call-Id and X-Treg-Cost-Micro from response headers
 */
export async function tregCall<T = unknown>(
  endpointId: string,
  options: {
    method?: "GET" | "POST";
    query?: Record<string, string | undefined>;
    body?: unknown;
    meta?: Record<string, string>;
    maxCostUsd?: number;
    idempotencyKey?: string;
  } = {},
): Promise<
  | {
      ok: true;
      data: T;
      callId: string | null;
      costMicro: number;
      replayed: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      callId: string | null;
    }
> {
  const token = process.env.TREG_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "TREG_TOKEN not configured",
      callId: null,
    };
  }

  const url = new URL(`${TREG_BASE_URL.replace(/\/$/, "")}/call/${endpointId}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }

  const metaTags = Object.entries({
    app: "cadence",
    ...options.meta,
  })
    .slice(0, 5)
    .map(([k, v]) => `${k}=${v.replace(/[^a-zA-Z0-9._:-]/g, "_")}`);

  const headers: Record<string, string> = {
    "X-Treg-Token": token,
    "X-Treg-Meta": metaTags.join(", "),
    "X-Treg-Route-Max-Cost": String(options.maxCostUsd ?? 0.05),
    "Idempotency-Key":
      options.idempotencyKey ?? crypto.randomBytes(8).toString("hex"),
  };

  const method = options.method ?? (options.body ? "POST" : "GET");
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    const callId = res.headers.get("X-Treg-Call-Id");
    const costMicro = Number(res.headers.get("X-Treg-Cost-Micro") ?? 0);
    const replayed = res.headers.get("X-Treg-Idempotent-Replay") === "true";

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 240) || `HTTP ${res.status}`,
        callId,
      };
    }

    const data = (await res.json()) as T;
    return {
      ok: true,
      data,
      callId,
      costMicro: Number.isFinite(costMicro) ? costMicro : 0,
      replayed,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "treg network error",
      callId: null,
    };
  }
}

const REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function safeHttpsUrl(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && /^https:\/\/[^\s"<>]+$/i.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

function normalizeTrendingList(raw: unknown): TrendingDeveloperItem[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Array.isArray((raw as Record<string, unknown>).developers)
        ? ((raw as Record<string, unknown>).developers as unknown[])
        : Array.isArray((raw as Record<string, unknown>).data)
          ? ((raw as Record<string, unknown>).data as unknown[])
          : Array.isArray((raw as Record<string, unknown>).rows)
            ? ((raw as Record<string, unknown>).rows as unknown[])
            : []
      : [];

  const seen = new Set<string>();
  const out: TrendingDeveloperItem[] = [];

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawUser =
      (typeof obj.username === "string" && obj.username) ||
      (typeof obj.login === "string" && obj.login) ||
      (typeof obj.handle === "string" && obj.handle) ||
      "";
    const username = rawUser.replace(/^@/, "").trim();
    if (!username || !USERNAME_PATTERN.test(username)) continue;
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const repoObj =
      obj.repo && typeof obj.repo === "object"
        ? (obj.repo as Record<string, unknown>)
        : null;

    out.push({
      username,
      name: typeof obj.name === "string" ? obj.name : null,
      avatarUrl: safeHttpsUrl(
        obj.avatar ?? obj.avatarUrl,
        `https://github.com/${username}.png?size=80`,
      ),
      repoName:
        typeof obj.repo_name === "string"
          ? obj.repo_name
          : repoObj && typeof repoObj.name === "string"
            ? repoObj.name
            : null,
      repoDescription:
        typeof obj.repo_description === "string"
          ? obj.repo_description
          : repoObj && typeof repoObj.description === "string"
            ? repoObj.description
            : null,
    });
  }
  return out;
}

async function fetchGithubTrendingHtmlFallback(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
}): Promise<TrendingDeveloperItem[]> {
  const langPath = input.language
    ? `/${encodeURIComponent(input.language.toLowerCase())}`
    : "";
  const since = input.since ?? "daily";
  const url = `https://github.com/trending/developers${langPath}?since=${since}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Cadence-Leaderboard/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const articleBlocks = html.split(/<article\s+class="Box-row[^"]*"[^>]*>/i).slice(1);
    const seen = new Set<string>();
    const out: TrendingDeveloperItem[] = [];

    for (const block of articleBlocks) {
      // Match the primary profile link inside h1.h3
      const h1Match = block.match(
        /<h1[^>]*class="[^"]*h3[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-zA-Z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/i,
      );
      const username = h1Match?.[1]?.trim();
      if (!username || !USERNAME_PATTERN.test(username)) continue;
      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const rawName = h1Match?.[2]?.replace(/<[^>]+>/g, "").trim() || null;
      const repoMatch = block.match(
        /<h1[^>]*class="[^"]*h4[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      );
      const repoName = repoMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null;

      out.push({
        username,
        name: rawName,
        avatarUrl: `https://github.com/${username}.png?size=80`,
        repoName,
        repoDescription: null,
      });
      if (out.length >= 12) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Fetches trending GitHub developers via treg (`scrapecreators.x.v1-github-trending-developers`)
 * when TREG_TOKEN is available, with automatic fallback to GitHub's public Trending Developers page.
 */
export async function fetchTrendingDevelopers(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
} = {}): Promise<TrendingDevelopersResult> {
  const since = input.since ?? "daily";
  const language = input.language?.trim() || "";

  if (process.env.TREG_TOKEN?.trim()) {
    const tregRes = await tregCall(
      "scrapecreators.x.v1-github-trending-developers",
      {
        method: "GET",
        query: {
          language: language || undefined,
          since,
        },
        meta: {
          feature: "trending-developers",
          since,
          ...(language ? { lang: language } : {}),
        },
      },
    );

    if (tregRes.ok) {
      const parsed = normalizeTrendingList(tregRes.data);
      if (parsed.length > 0) {
        return {
          ok: true,
          source: "treg",
          language: language || "all",
          since,
          developers: parsed.slice(0, 12),
          tregCallId: tregRes.callId,
          costMicro: tregRes.costMicro,
        };
      }
    }
  }

  const fallbackDevs = await fetchGithubTrendingHtmlFallback({
    language: language || undefined,
    since,
  });

  return {
    ok: true,
    source: "github-trending",
    language: language || "all",
    since,
    developers: fallbackDevs,
    tregCallId: null,
    costMicro: 0,
  };
}

function parseNumericCount(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) return Math.round(val);
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const num = Number.parseFloat(cleaned);
    if (Number.isFinite(num)) {
      if (/k$/i.test(cleaned)) return Math.round(num * 1000);
      return Math.round(num);
    }
  }
  return 0;
}

function normalizeTrendingRepos(raw: unknown): TrendingRepositoryItem[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Array.isArray((raw as Record<string, unknown>).rows)
        ? ((raw as Record<string, unknown>).rows as unknown[])
        : Array.isArray((raw as Record<string, unknown>).repositories)
          ? ((raw as Record<string, unknown>).repositories as unknown[])
          : Array.isArray((raw as Record<string, unknown>).data)
            ? ((raw as Record<string, unknown>).data as unknown[])
            : []
      : [];

  const seen = new Set<string>();
  const out: TrendingRepositoryItem[] = [];

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawFull =
      (typeof obj.full_name === "string" && obj.full_name) ||
      (typeof obj.name === "string" && obj.name) ||
      (typeof obj.url === "string" &&
        obj.url.replace(/^https?:\/\/github\.com\//i, "")) ||
      "";
    const parts = rawFull
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const owner =
      parts.length >= 2
        ? parts[0]!
        : typeof obj.owner === "string"
          ? obj.owner.trim()
          : typeof obj.author === "string"
            ? obj.author.trim()
            : "";
    const repoName =
      parts.length >= 2
        ? parts[1]!
        : parts[0] ||
          (typeof obj.repo === "string" ? obj.repo.trim() : "");

    if (
      !owner ||
      !repoName ||
      !USERNAME_PATTERN.test(owner) ||
      !REPO_NAME_PATTERN.test(repoName)
    ) {
      continue;
    }
    const fullName = `${owner}/${repoName}`;
    const key = fullName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      owner,
      repoName,
      fullName,
      url: `https://github.com/${fullName}`,
      description:
        typeof obj.description === "string" && obj.description.trim()
          ? obj.description.trim()
          : null,
      language:
        typeof obj.language === "string" && obj.language.trim()
          ? obj.language.trim()
          : null,
      stars: parseNumericCount(obj.stars ?? obj.stargazers_count ?? obj.total_stars),
      forks: parseNumericCount(obj.forks ?? obj.forks_count),
      starsToday: parseNumericCount(
        obj.stars_today ?? obj.currentPeriodStars ?? obj.starsToday ?? 0,
      ),
    });
  }
  return out;
}

async function fetchGithubTrendingReposHtmlFallback(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
}): Promise<TrendingRepositoryItem[]> {
  const langPath = input.language
    ? `/${encodeURIComponent(input.language.toLowerCase())}`
    : "";
  const since = input.since ?? "daily";
  const url = `https://github.com/trending${langPath}?since=${since}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Cadence-Leaderboard/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const articleBlocks = html
      .split(/<article\s+class="Box-row[^"]*"[^>]*>/i)
      .slice(1);
    const seen = new Set<string>();
    const out: TrendingRepositoryItem[] = [];

    for (const block of articleBlocks) {
      const h2Match = block.match(
        /<h2[^>]*class="[^"]*h3[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)"[^>]*>/i,
      );
      const owner = h2Match?.[1]?.trim();
      const repoName = h2Match?.[2]?.trim();
      if (!owner || !repoName || !USERNAME_PATTERN.test(owner)) continue;
      const fullName = `${owner}/${repoName}`;
      const key = fullName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const description =
        descMatch?.[1]
          ?.replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim() || null;

      const langMatch = block.match(
        /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/i,
      );
      const language = langMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null;

      const starMatch = block.match(
        /href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/i,
      );
      const stars = parseNumericCount(
        starMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "0",
      );

      const forkMatch = block.match(
        /href="\/[^"]+\/forks"[^>]*>([\s\S]*?)<\/a>/i,
      );
      const forks = parseNumericCount(
        forkMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "0",
      );

      const todayMatch = block.match(/([\d,]+)\s+stars\s+(today|this\s+week|this\s+month)/i);
      const starsToday = parseNumericCount(todayMatch?.[1] ?? "0");

      out.push({
        owner,
        repoName,
        fullName,
        url: `https://github.com/${fullName}`,
        description,
        language,
        stars,
        forks,
        starsToday,
      });
      if (out.length >= 12) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Fetches trending GitHub repositories via treg (`crawl4ai.github.trending.repositories`
 * or `scrapecreators.x.v1-github-trending-repositories`) when TREG_TOKEN is configured,
 * with automatic fallback to GitHub's public Trending Repositories page.
 */
export async function fetchTrendingRepositories(input: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
} = {}): Promise<TrendingRepositoriesResult> {
  const since = input.since ?? "daily";
  const language = input.language?.trim() || "";

  if (process.env.TREG_TOKEN?.trim()) {
    if (!language) {
      const c4Res = await tregCall("crawl4ai.github.trending.repositories", {
        method: "POST",
        body: { since, limit: 15 },
        meta: { feature: "trending-repos", since },
      });
      if (c4Res.ok) {
        const parsed = normalizeTrendingRepos(c4Res.data);
        if (parsed.length > 0) {
          return {
            ok: true,
            source: "treg-crawl4ai",
            language: "all",
            since,
            repositories: parsed.slice(0, 12),
            tregCallId: c4Res.callId,
            costMicro: c4Res.costMicro,
          };
        }
      }
    }

    const scRes = await tregCall(
      "scrapecreators.x.v1-github-trending-repositories",
      {
        method: "GET",
        query: {
          language: language || undefined,
          since,
        },
        meta: {
          feature: "trending-repos",
          since,
          ...(language ? { lang: language } : {}),
        },
      },
    );
    if (scRes.ok) {
      const parsed = normalizeTrendingRepos(scRes.data);
      if (parsed.length > 0) {
        return {
          ok: true,
          source: "treg-scrapecreators",
          language: language || "all",
          since,
          repositories: parsed.slice(0, 12),
          tregCallId: scRes.callId,
          costMicro: scRes.costMicro,
        };
      }
    }
  }

  const fallbackRepos = await fetchGithubTrendingReposHtmlFallback({
    language: language || undefined,
    since,
  });

  return {
    ok: true,
    source: "github-trending",
    language: language || "all",
    since,
    repositories: fallbackRepos,
    tregCallId: null,
    costMicro: 0,
  };
}

const PORTFOLIO_CACHE_TTL_MS = 15 * 60 * 1000;
const PORTFOLIO_EMPTY_TTL_MS = 30 * 1000;
const PORTFOLIO_CACHE_MAX = 240;
const portfolioCache = new Map<
  string,
  { expiresAt: number; value: BuilderPortfolioResult }
>();

function setPortfolioCache(
  key: string,
  value: BuilderPortfolioResult,
  ttlMs: number,
) {
  portfolioCache.delete(key);
  portfolioCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  if (portfolioCache.size > PORTFOLIO_CACHE_MAX) {
    const oldest = portfolioCache.keys().next().value;
    if (oldest !== undefined) portfolioCache.delete(oldest);
  }
}

function summarizePortfolio(
  username: string,
  repos: BuilderRepoItem[],
  source: BuilderPortfolioResult["source"],
  tregCallId: string | null = null,
  costMicro = 0,
): BuilderPortfolioResult {
  const sorted = [...repos].sort((a, b) => b.stars - a.stars);
  const langMap = new Map<string, { count: number; stars: number }>();
  let totalStars = 0;

  for (const r of repos) {
    totalStars += r.stars;
    if (r.language) {
      const prev = langMap.get(r.language) ?? { count: 0, stars: 0 };
      langMap.set(r.language, {
        count: prev.count + 1,
        stars: prev.stars + r.stars,
      });
    }
  }

  const topLanguages = Array.from(langMap.entries())
    .map(([language, stats]) => ({ language, ...stats }))
    .sort((a, b) => b.stars - a.stars || b.count - a.count)
    .slice(0, 5);

  return {
    ok: true,
    username,
    source,
    topLanguages,
    totalStars,
    repos: sorted.slice(0, 6),
    tregCallId,
    costMicro,
  };
}

function normalizeUserRepos(
  username: string,
  raw: unknown,
): BuilderRepoItem[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Array.isArray((raw as Record<string, unknown>).repositories)
        ? ((raw as Record<string, unknown>).repositories as unknown[])
        : Array.isArray((raw as Record<string, unknown>).repos)
          ? ((raw as Record<string, unknown>).repos as unknown[])
          : Array.isArray((raw as Record<string, unknown>).data)
            ? ((raw as Record<string, unknown>).data as unknown[])
            : []
      : [];

  const out: BuilderRepoItem[] = [];
  const seen = new Set<string>();

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (obj.fork === true) continue;
    const name =
      (typeof obj.name === "string" && obj.name.trim()) || "";
    if (!name || !REPO_NAME_PATTERN.test(name)) continue;
    const fullName =
      typeof obj.full_name === "string" &&
      /^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(obj.full_name.trim())
        ? obj.full_name.trim()
        : `${username}/${name}`;
    const key = fullName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      fullName,
      url: safeHttpsUrl(obj.html_url, `https://github.com/${fullName}`),
      description:
        typeof obj.description === "string" && obj.description.trim()
          ? obj.description.trim()
          : null,
      language:
        typeof obj.language === "string" && obj.language.trim()
          ? obj.language.trim()
          : null,
      stars: parseNumericCount(obj.stargazers_count ?? obj.stars ?? 0),
      forks: parseNumericCount(obj.forks_count ?? obj.forks ?? 0),
      pushedAt:
        typeof obj.pushed_at === "string"
          ? obj.pushed_at
          : typeof obj.updated_at === "string"
            ? obj.updated_at
            : null,
    });
  }
  return out;
}

async function fetchGithubProfilePinnedFallback(
  username: string,
): Promise<BuilderRepoItem[]> {
  try {
    const res = await fetch(`https://github.com/${encodeURIComponent(username)}`, {
      headers: {
        "User-Agent": "Cadence-Leaderboard/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const itemBlocks = html
      .split(/class="[^"]*pinned-item-list-item-content[^"]*"/i)
      .slice(1);
    const out: BuilderRepoItem[] = [];

    for (const block of itemBlocks) {
      const linkMatch = block.match(/href="\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)"/i);
      const owner = linkMatch?.[1]?.trim() || username;
      const name = linkMatch?.[2]?.trim();
      if (!name) continue;
      const fullName = `${owner}/${name}`;

      const descMatch = block.match(
        /<p[^>]*class="[^"]*pinned-item-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      );
      const description =
        descMatch?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ||
        null;

      const langMatch = block.match(
        /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/i,
      );
      const language = langMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null;

      const starMatch = block.match(
        /href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/i,
      );
      const stars = parseNumericCount(
        starMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "0",
      );

      const forkMatch = block.match(
        /href="\/[^"]+\/forks"[^>]*>([\s\S]*?)<\/a>/i,
      );
      const forks = parseNumericCount(
        forkMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "0",
      );

      out.push({
        name,
        fullName,
        url: `https://github.com/${fullName}`,
        description,
        language,
        stars,
        forks,
        pushedAt: null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Enriches a builder's profile with their top repositories, star velocity, and language stack
 * via treg (`scrapecreators.x.v1-github-user-repositories`), with automatic fallback to
 * GitHub REST API and pinned repositories.
 */
export async function fetchBuilderPortfolio(
  rawUsername: string,
): Promise<BuilderPortfolioResult> {
  const username = rawUsername.trim().replace(/^@/, "");
  const cacheKey = username.toLowerCase();
  const cached = portfolioCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 1. Try treg (`scrapecreators.x.v1-github-user-repositories`) if TREG_TOKEN is set
  if (process.env.TREG_TOKEN?.trim()) {
    const tregRes = await tregCall(
      "scrapecreators.x.v1-github-user-repositories",
      {
        method: "GET",
        query: {
          handle: username,
          sort: "updated",
          direction: "desc",
        },
        meta: {
          feature: "builder-portfolio",
          user: username,
        },
      },
    );
    if (tregRes.ok) {
      const repos = normalizeUserRepos(username, tregRes.data);
      if (repos.length > 0) {
        const result = summarizePortfolio(
          username,
          repos,
          "treg",
          tregRes.callId,
          tregRes.costMicro,
        );
        setPortfolioCache(cacheKey, result, PORTFOLIO_CACHE_TTL_MS);
        return result;
      }
    }
  }

  // 2. Try GitHub public REST API
  try {
    const ghHeaders: Record<string, string> = {
      "User-Agent": "Cadence-Leaderboard/1.0",
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN?.trim()) {
      ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
    }
    const ghRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=24`,
      { headers: ghHeaders, signal: AbortSignal.timeout(8000) },
    );
    if (ghRes.ok) {
      const data = (await ghRes.json()) as unknown;
      const repos = normalizeUserRepos(username, data);
      if (repos.length > 0) {
        const result = summarizePortfolio(username, repos, "github-api");
        setPortfolioCache(cacheKey, result, PORTFOLIO_CACHE_TTL_MS);
        return result;
      }
    }
  } catch {
    // Fall through to profile HTML pinned parser
  }

  // 3. Fallback to pinned repositories on github.com/<username>
  const pinned = await fetchGithubProfilePinnedFallback(username);
  const result = summarizePortfolio(username, pinned, "github-profile");
  setPortfolioCache(
    cacheKey,
    result,
    pinned.length > 0 ? PORTFOLIO_CACHE_TTL_MS : PORTFOLIO_EMPTY_TTL_MS,
  );
  return result;
}
