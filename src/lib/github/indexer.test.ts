import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessBot,
  buildBatchedUserQuery,
  chunkDateRange,
  clickHouseCandidate,
  computeIndexedMetrics,
  FOLLOWER_BUCKETS,
  hydratedToCalendar,
  isBotLogin,
  mergeHydratedChunks,
  parseBatchedResponse,
  parseClickHouseRows,
  parseFollowerSweepPage,
  rollingYearRange,
} from "./indexer.ts";
import type { DayCount } from "./types.ts";

function days(counts: number[], start = "2025-10-20"): DayCount[] {
  return counts.map((count, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), count, level: 0 };
  });
}

describe("parseClickHouseRows", () => {
  it("parses JSONEachRow, coerces counts, drops bots and junk lines", () => {
    const text = [
      `{"actor_login":"danielhanchen","pushes":"900","prs_opened":"120","pr_reviews":"40","issues_opened":"9","distinct_repos":"12","active_days":"30"}`,
      `{"actor_login":"dependabot[bot]","pushes":"5000","prs_opened":"800","pr_reviews":"0","issues_opened":"0","distinct_repos":"90","active_days":"30"}`,
      "not json",
      `{"actor_login":"someone-bot","pushes":"10","prs_opened":"1","pr_reviews":"0","issues_opened":"0","distinct_repos":"1","active_days":"9"}`,
    ].join("\n");
    const rows = parseClickHouseRows(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.login, "danielhanchen");
    assert.equal(rows[0]!.signals.prsOpened, 120);
    const candidate = clickHouseCandidate(rows[0]!);
    assert.equal(candidate.source, "clickhouse");
    assert.ok(candidate.priority > 600);
  });
});

describe("isBotLogin / assessBot", () => {
  it("flags bot-shaped logins", () => {
    assert.ok(isBotLogin("dependabot[bot]"));
    assert.ok(isBotLogin("my-ci-bot"));
    assert.ok(isBotLogin("renovate-helper"));
    assert.ok(!isBotLogin("torvalds"));
    assert.ok(!isBotLogin("botanist-dev"));
  });

  it("rejects a constant 1-per-day cron calendar", () => {
    const verdict = assessBot({ login: "cronny", days: days(Array(365).fill(1)) });
    assert.ok(verdict.isBot);
    assert.ok(verdict.reasons.includes("constant-cron-cadence"));
  });

  it("passes a prolific human with varied days and collaboration", () => {
    const counts = Array.from({ length: 365 }, (_, i) =>
      i % 7 < 2 ? 3 : 40 + ((i * 37) % 180),
    );
    const verdict = assessBot({
      login: "danielhanchen",
      days: days(counts),
      commits: 40000,
      pullRequests: 9000,
      reviews: 800,
      issues: 300,
      distinctRepos: 25,
    });
    assert.equal(verdict.isBot, false);
    assert.ok(verdict.score < 0.2);
  });

  it("rejects a commit-only single-repo firehose bulk dump", () => {
    const counts = Array(365).fill(0);
    counts[100] = 9000;
    counts[200] = 8000;
    const verdict = assessBot({
      login: "farmer",
      days: days(counts),
      commits: 17000,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      distinctRepos: 1,
    });
    assert.ok(verdict.isBot);
  });

  it("rejects empty calendars", () => {
    assert.ok(assessBot({ login: "ghost", days: [] }).isBot);
  });
});

describe("date chunking", () => {
  it("splits a rolling year into 90-day windows with no gaps", () => {
    const range = rollingYearRange("2026-10-19");
    assert.equal(range.to, "2026-10-19");
    const chunks = chunkDateRange(range.from, range.to, 90);
    assert.equal(chunks.length, 5);
    assert.equal(chunks[0]!.from, range.from);
    assert.equal(chunks[chunks.length - 1]!.to, range.to);
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = new Date(`${chunks[i - 1]!.to}T00:00:00Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
      assert.equal(prevEnd.toISOString().slice(0, 10), chunks[i]!.from);
    }
  });
});

describe("GraphQL batching", () => {
  const node = (login: string, counts: number[]) => ({
    login,
    name: null,
    avatarUrl: `https://github.com/${login}.png`,
    url: `https://github.com/${login}`,
    bio: null,
    followers: { totalCount: 42 },
    contributionsCollection: {
      totalCommitContributions: counts.reduce((a, b) => a + b, 0),
      restrictedContributionsCount: 0,
      totalPullRequestContributions: 3,
      totalPullRequestReviewContributions: 2,
      totalIssueContributions: 1,
      contributionCalendar: {
        totalContributions: counts.reduce((a, b) => a + b, 0),
        weeks: [
          {
            contributionDays: counts.map((count, i) => ({
              date: `2026-10-${String(i + 1).padStart(2, "0")}`,
              contributionCount: count,
            })),
          },
        ],
      },
    },
  });

  it("builds one aliased query per login", () => {
    const q = buildBatchedUserQuery(["torvalds", "antfu"]);
    assert.match(q, /u0: user\(login: "torvalds"\)/);
    assert.match(q, /u1: user\(login: "antfu"\)/);
    assert.match(q, /rateLimit/);
  });

  it("parses users and reports the timed-out alias as missing", () => {
    const body = {
      data: {
        rateLimit: { cost: 1, remaining: 4999 },
        u0: node("torvalds", [5, 0, 9]),
        u1: null,
      },
    };
    const parsed = parseBatchedResponse(body, ["torvalds", "heavyuser"]);
    assert.equal(parsed.rateCost, 1);
    assert.equal(parsed.users.get("torvalds")?.total, 14);
    assert.deepEqual(parsed.missing, ["heavyuser"]);
  });

  it("merges 90-day chunks without double-counting overlap days", () => {
    const a = parseBatchedResponse(
      { data: { u0: node("heavy", [10, 20]) } },
      ["heavy"],
    ).users.get("heavy")!;
    const b = parseBatchedResponse(
      { data: { u0: node("heavy", [10, 20, 30]) } },
      ["heavy"],
    ).users.get("heavy")!;
    const merged = mergeHydratedChunks([a, b])!;
    assert.equal(merged.days.length, 3);
    assert.equal(merged.total, 60);
  });

  it("turns a follower-sweep page into ranked candidates", () => {
    const page = parseFollowerSweepPage({
      data: {
        search: {
          pageInfo: { endCursor: "abc", hasNextPage: true },
          nodes: [
            {
              login: "big",
              followers: { totalCount: 100000 },
              contributionsCollection: {
                totalCommitContributions: 5000,
                contributionCalendar: { totalContributions: 6200 },
              },
            },
            { login: "snyk-bot", followers: { totalCount: 10 }, contributionsCollection: { contributionCalendar: { totalContributions: 5 } } },
          ],
        },
      },
    });
    assert.equal(page.candidates.length, 1);
    assert.equal(page.candidates[0]!.source, "followers");
    assert.equal(page.endCursor, "abc");
    assert.ok(FOLLOWER_BUCKETS.length >= 5);
  });
});

describe("computeIndexedMetrics", () => {
  it("materializes every window total and score from one calendar", () => {
    const counts: number[] = Array.from({ length: 365 }, (_, i) =>
      i % 3 === 0 ? 0 : 6,
    );
    const calendar = hydratedToCalendar(
      {
        profile: {
          login: "steady",
          name: null,
          avatarUrl: "x",
          htmlUrl: "y",
          bio: null,
          followers: 10,
        },
        days: days(counts, "2025-10-20"),
        commits: 1000,
        pullRequests: 50,
        reviews: 20,
        issues: 5,
        restricted: 0,
        total: counts.reduce((a, b) => a + b, 0),
      },
      "2026-10-19",
    );
    const metrics = computeIndexedMetrics(calendar, "2026-10-19");
    assert.ok(metrics.total7d < metrics.total30d);
    assert.ok(metrics.total30d < metrics.total90d);
    assert.ok(metrics.total90d < metrics.total12m);
    assert.ok(metrics.bestDayCount === 6);
    assert.ok(metrics.score12m > 0 && metrics.score12m <= 100);
  });
});
