import type { DayPull } from "./types.ts";

export type SearchPullItem = {
  number?: number;
  title?: string;
  html_url?: string;
  user?: { login?: string };
  pull_request?: { merged_at?: string | null };
};

export function mergedPullQueries(username: string, date: string): {
  opened: string;
  merged: string;
} {
  return {
    opened: `is:pr is:merged merged:${date} author:${username}`,
    merged: `is:pr is:merged merged:${date} merged-by:${username}`,
  };
}

export function parseMergedPulls(
  username: string,
  items: SearchPullItem[],
  date: string,
): DayPull[] {
  const pulls: DayPull[] = [];
  const seen = new Set<string>();
  const login = username.toLowerCase();
  for (const item of items) {
    const htmlUrl = item.html_url ?? "";
    if (!htmlUrl || seen.has(htmlUrl)) continue;
    seen.add(htmlUrl);
    const repoMatch = htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\//);
    const author = item.user?.login ?? "";
    pulls.push({
      number: item.number ?? 0,
      title: (item.title ?? "Pull request").slice(0, 160),
      htmlUrl,
      repo: repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : "repository",
      mergedAt: item.pull_request?.merged_at ?? `${date}T00:00:00Z`,
      role: author.toLowerCase() === login ? "opened" : "merged",
    });
  }
  return pulls;
}
