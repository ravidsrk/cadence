import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareDelta } from "./compare.ts";
import { countCommits } from "./commits.ts";
import { parseMergedPulls, mergedPullQueries, searchPageCount } from "./pulls.ts";
import {
  classifyArchetype,
  classifyTier,
  computeCadenceScore,
  computeWindowStats,
  rankBoard,
} from "./board.ts";
import { calendarCsv } from "./csv.ts";
import { quietStats } from "./gaps.ts";
import { apiErrorStatus } from "./http.ts";
import { compactCount, escapeXml, heatmapGrid, shiftDate } from "./layout.ts";
import { parseContributionHtml } from "./parse.ts";
import { heatmapSvg, shareCardSvg, skylineSvg } from "./svg.ts";
import type { DayCount } from "./types.ts";

function days(rows: Array<[string, number]>): DayCount[] {
  return rows.map(([date, count]) => ({
    date,
    count,
    level: count > 0 ? 1 : 0,
  }));
}

describe("quietStats", () => {
  it("finds the longest empty run and current pause", () => {
    const stats = quietStats(
      days([
        ["2026-09-01", 2],
        ["2026-09-02", 0],
        ["2026-09-03", 0],
        ["2026-09-04", 0],
        ["2026-09-05", 1],
        ["2026-09-06", 0],
        ["2026-09-07", 0],
      ]),
      "2026-09-07",
    );
    assert.equal(stats.longestGap?.days, 3);
    assert.equal(stats.longestGap?.start, "2026-09-02");
    assert.equal(stats.longestGap?.end, "2026-09-04");
    assert.equal(stats.currentPause, 2);
  });

  it("reports no pause on an active today", () => {
    const stats = quietStats(
      days([
        ["2026-09-06", 0],
        ["2026-09-07", 4],
      ]),
      "2026-09-07",
    );
    assert.equal(stats.currentPause, 0);
  });
});

describe("shiftDate", () => {
  it("moves within the calendar and clamps at the ends", () => {
    const list = days([
      ["2026-09-01", 1],
      ["2026-09-02", 0],
      ["2026-09-03", 2],
    ]);
    assert.equal(shiftDate(list, "2026-09-02", -1), "2026-09-01");
    assert.equal(shiftDate(list, "2026-09-02", 1), "2026-09-03");
    assert.equal(shiftDate(list, "2026-09-01", -1), "2026-09-01");
    assert.equal(shiftDate(list, "2026-09-03", 1), "2026-09-03");
  });

  it("omits a stub leading month label when the next month begins within 2 weeks", () => {
    const grid = heatmapGrid(
      days([
        ["2025-09-28", 1],
        ["2025-10-05", 2],
        ["2025-10-12", 3],
      ]),
    );
    assert.deepEqual(
      grid.monthLabels.map((m) => m.label),
      ["Oct"],
    );
  });
});

describe("exports", () => {
  it("writes csv rows and compact counts", () => {
    const csv = calendarCsv(days([["2026-09-01", 4]]));
    assert.match(csv, /date,count,level/);
    assert.match(csv, /2026-09-01,4,1/);
    assert.equal(compactCount(97), "97");
    assert.equal(compactCount(12100), "12k");
    assert.equal(
      escapeXml('a&b<"c"'),
      "a" + "&" + "amp;" + "b" + "&" + "lt;" + "&" + "quot;" + "c" + "&" + "quot;",
    );
  });
});

describe("compareDelta", () => {
  it("names the leader and formats the gap", () => {
    const rows = compareDelta(
      { login: "gaearon", total: 12000, streak: 12, consistency: 0.8 },
      { login: "yyx990803", total: 9000, streak: 34, consistency: 0.8 },
    );
    assert.equal(rows[0]?.leader, "left");
    assert.equal(rows[0]?.note, "gaearon +3,000");
    assert.equal(rows[1]?.leader, "right");
    assert.equal(rows[1]?.note, "yyx990803 +22d");
    assert.equal(rows[2]?.leader, "tie");
    assert.equal(rows[2]?.note, "tied");
  });
});

describe("rankBoard", () => {
  it("orders by streak and sends errors last", () => {
    const ranked = rankBoard(
      [
        {
          username: "slow",
          calendar: {
            username: "slow",
            profile: {
              login: "slow",
              name: null,
              avatarUrl: "",
              htmlUrl: "",
              bio: null,
            },
            range: { from: "2026-01-01", to: "2026-01-03" },
            days: [
              { date: "2026-01-01", count: 1, level: 1 },
              { date: "2026-01-02", count: 0, level: 0 },
              { date: "2026-01-03", count: 1, level: 1 },
            ],
            stats: {
              total: 2,
              today: 1,
              week: 2,
              currentStreak: 1,
              longestStreak: 1,
              bestDay: { date: "2026-01-01", count: 1 },
              activeDays: 2,
            },
          },
        },
        {
          username: "fast",
          calendar: {
            username: "fast",
            profile: {
              login: "fast",
              name: null,
              avatarUrl: "",
              htmlUrl: "",
              bio: null,
            },
            range: { from: "2026-01-01", to: "2026-01-03" },
            days: [
              { date: "2026-01-01", count: 4, level: 2 },
              { date: "2026-01-02", count: 4, level: 2 },
              { date: "2026-01-03", count: 4, level: 2 },
            ],
            stats: {
              total: 12,
              today: 4,
              week: 12,
              currentStreak: 3,
              longestStreak: 3,
              bestDay: { date: "2026-01-03", count: 4 },
              activeDays: 3,
            },
          },
        },
        {
          username: "gone",
          calendar: { error: "Not found", code: "not_found" },
        },
      ],
      "streak",
    );
    assert.equal(ranked[0]?.username, "fast");
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[1]?.username, "slow");
    assert.equal(ranked[2]?.username, "gone");
    assert.ok(ranked[2]?.error);
  });

  it("ranks by peak day and by a picked date", () => {
    const rows = [
      {
        username: "slow",
        calendar: {
          username: "slow",
          profile: {
            login: "slow",
            name: null,
            avatarUrl: "",
            htmlUrl: "",
            bio: null,
          },
          range: { from: "2026-01-01", to: "2026-01-03" },
          days: [
            { date: "2026-01-01", count: 9, level: 3 },
            { date: "2026-01-02", count: 0, level: 0 },
            { date: "2026-01-03", count: 1, level: 1 },
          ],
          stats: {
            total: 10,
            today: 1,
            week: 10,
            currentStreak: 1,
            longestStreak: 1,
            bestDay: { date: "2026-01-01", count: 9 },
            activeDays: 2,
          },
        },
      },
      {
        username: "fast",
        calendar: {
          username: "fast",
          profile: {
            login: "fast",
            name: null,
            avatarUrl: "",
            htmlUrl: "",
            bio: null,
          },
          range: { from: "2026-01-01", to: "2026-01-03" },
          days: [
            { date: "2026-01-01", count: 2, level: 1 },
            { date: "2026-01-02", count: 4, level: 2 },
            { date: "2026-01-03", count: 12, level: 4 },
          ],
          stats: {
            total: 18,
            today: 12,
            week: 18,
            currentStreak: 3,
            longestStreak: 3,
            bestDay: { date: "2026-01-03", count: 12 },
            activeDays: 3,
          },
        },
      },
    ];
    const peak = rankBoard(rows, "peak");
    assert.equal(peak[0]?.username, "fast");
    assert.equal(peak[0]?.bestDay?.count, 12);
    const onFirst = rankBoard(rows, "day", "2026-01-01");
    assert.equal(onFirst[0]?.username, "slow");
    assert.equal(onFirst[0]?.byDate["2026-01-01"], 9);
  });
});

describe("merged pulls", () => {
  it("builds the day query and marks opened vs merged", () => {
    const queries = mergedPullQueries("torvalds", "2026-10-01");
    assert.match(queries.opened, /author:torvalds/);
    assert.match(queries.merged, /merged-by:torvalds/);
    const pulls = parseMergedPulls(
      "torvalds",
      [
        {
          number: 9,
          title: "Land it",
          html_url: "https://github.com/torvalds/linux/pull/9",
          user: { login: "someone" },
          pull_request: { merged_at: "2026-10-01T12:00:00Z" },
        },
        {
          number: 4,
          title: "Mine",
          html_url: "https://github.com/org/repo/pull/4",
          user: { login: "Torvalds" },
        },
      ],
      "2026-10-01",
    );
    assert.equal(pulls[0]?.role, "merged");
    assert.equal(pulls[0]?.repo, "torvalds/linux");
    assert.equal(pulls[1]?.role, "opened");
    assert.equal(searchPageCount(0), 1);
    assert.equal(searchPageCount(100), 1);
    assert.equal(searchPageCount(101), 2);
    assert.equal(searchPageCount(5000), 10);
    const counted = countCommits({
      reportedTotal: 514,
      publicSeen: 182,
      privateSeen: 332,
    });
    assert.equal(counted.total, 514);
    assert.equal(counted.publicTotal, 182);
    assert.equal(counted.privateTotal, 332);
  });
});

describe("3D skyline SVG & share card", () => {
  it("renders isometric 3D skyline polygons and 3D/2D share cards", () => {
    const sampleDays = days([
      ["2026-09-01", 0],
      ["2026-09-02", 4],
      ["2026-09-03", 12],
    ]);
    const sky = skylineSvg(sampleDays, { width: 840, height: 210 });
    assert.match(sky, /<svg/);
    assert.match(sky, /<polygon points=/);
    assert.match(sky, /12 on 2026-09-03/);

    const card3d = shareCardSvg({
      username: "ravidsrk",
      profile: {
        login: "ravidsrk",
        name: "Ravindra",
        avatarUrl: "",
        htmlUrl: "",
        bio: null,
      },
      range: { from: "2026-09-01", to: "2026-09-03" },
      days: sampleDays,
      stats: {
        total: 16,
        today: 12,
        week: 16,
        currentStreak: 2,
        longestStreak: 2,
        bestDay: { date: "2026-09-03", count: 12 },
        activeDays: 2,
      },
    });
    assert.match(card3d, /CADENCE · 3D SKYLINE/);
    assert.match(card3d, /CONSISTENCY/);
    assert.match(card3d, /67%/);
    assert.match(card3d, /<polygon points=/);
  });
});

describe("Cadence Score & Window Horizons", () => {
  it("rewards sustained daily cadence over a single-day spike dump", () => {
    const sustained = computeCadenceScore({
      total: 900,
      activeDays: 300,
      windowDays: 365,
      currentStreak: 25,
      longestStreak: 60,
      bestDayCount: 15,
    });
    const spikeBot = computeCadenceScore({
      total: 900,
      activeDays: 3,
      windowDays: 365,
      currentStreak: 0,
      longestStreak: 2,
      bestDayCount: 850,
    });
    assert.ok(sustained.total > 70, `Expected sustained score > 70, got ${sustained.total}`);
    assert.ok(spikeBot.total < 30, `Expected spikeBot score < 30, got ${spikeBot.total}`);
    assert.ok(sustained.rhythmPts > spikeBot.rhythmPts);
    assert.ok(sustained.consistencyPts > spikeBot.consistencyPts);
  });

  it("computes window-scoped stats (7d / 30d) and classifies builder archetypes", () => {
    const ranked = rankBoard(
      [
        {
          username: "relentless-dev",
          calendar: {
            username: "relentless-dev",
            profile: {
              login: "relentless-dev",
              name: "Relentless Dev",
              avatarUrl: "",
              htmlUrl: "",
              bio: null,
            },
            range: { from: "2026-09-01", to: "2026-09-07" },
            days: [
              { date: "2026-09-01", count: 5, level: 2 },
              { date: "2026-09-02", count: 6, level: 2 },
              { date: "2026-09-03", count: 4, level: 2 },
              { date: "2026-09-04", count: 8, level: 3 },
              { date: "2026-09-05", count: 5, level: 2 },
              { date: "2026-09-06", count: 7, level: 3 },
              { date: "2026-09-07", count: 9, level: 3 },
            ],
            stats: {
              total: 44,
              today: 9,
              week: 44,
              currentStreak: 7,
              longestStreak: 7,
              bestDay: { date: "2026-09-07", count: 9 },
              activeDays: 7,
            },
          },
        },
      ],
      "score",
    );
    const entry = ranked[0]!;
    assert.equal(entry.archetype.id, "relentless");
    const w7 = computeWindowStats(entry, "7d", "2026-09-07");
    assert.equal(w7.total, 44);
    assert.equal(w7.activeDays, 7);
    assert.equal(w7.streak, 7);
    assert.equal(w7.archetype.id, "relentless");

    const surgingArch = classifyArchetype({
      consistency: 0.5,
      streak: 3,
      longest: 8,
      avgPerActive: 4,
      bestDayCount: 10,
      momentumDelta: 45,
      windowDays: 30,
    });
    assert.equal(surgingArch.id, "surging");

    assert.equal(classifyTier(88).id, "apex");
    assert.equal(classifyTier(75).id, "diamond");
    assert.equal(classifyTier(60).id, "gold");
    assert.equal(classifyTier(42).id, "silver");
    assert.equal(classifyTier(20).id, "bronze");
  });
});

describe("Adversarial Regression Suite (HTML parsing, commit attribution, SVG escaping, HTTP status)", () => {
  it("parseContributionHtml anchors attribute names and strips nested HTML inside tool-tip", () => {
    const html = `
      <table>
        <td data-testid="wrong-id-1" data-view-component-id="wrong-id-2" id="contribution-day-component-0-0" data-date="2026-10-16" data-level="2" class="ContributionCalendar-day"></td>
        <td data-testid="wrong-id-3" id="contribution-day-component-0-1" data-date="2026-10-17" data-level="0" class="ContributionCalendar-day"></td>
      </table>
      <tool-tip for="contribution-day-component-0-0"><strong>14</strong> contributions on October 16th.</tool-tip>
      <tool-tip for="contribution-day-component-0-1">No contributions on October 17th.</tool-tip>
    `;
    const parsed = parseContributionHtml(html);
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], { date: "2026-10-16", count: 14, level: 2 });
    assert.deepEqual(parsed[1], { date: "2026-10-17", count: 0, level: 0 });
  });

  it("parseContributionHtml returns [] when active cells have no matching tool-tip counts so caller falls back to JSON mirror", () => {
    const brokenHtml = `
      <td id="cell-1" data-date="2026-10-16" data-level="3" class="ContributionCalendar-day"></td>
    `;
    assert.deepEqual(parseContributionHtml(brokenHtml), []);
  });

  it("countCommits attributes unpaginated >100 public commits to publicTotal when privateSeen is 0", () => {
    const unpaginatedPublic = countCommits({
      reportedTotal: 250,
      publicSeen: 100,
      privateSeen: 0,
    });
    assert.equal(unpaginatedPublic.total, 250);
    assert.equal(unpaginatedPublic.publicTotal, 250);
    assert.equal(unpaginatedPublic.privateTotal, 0);
  });

  it("compactCount formats 999,500..999,999 as 1m instead of 1000k", () => {
    assert.equal(compactCount(999_499), "999k");
    assert.equal(compactCount(999_500), "1m");
    assert.equal(compactCount(999_950), "1m");
    assert.equal(compactCount(1_250_000), "1.3m");
  });

  it("quietStats falls back to all months when no month has >= 14 days", () => {
    const shortRange = days([
      ["2026-10-01", 2],
      ["2026-10-02", 0],
      ["2026-10-03", 5],
    ]);
    const stats = quietStats(shortRange, "2026-10-03");
    assert.equal(stats.quietestMonth?.key, "2026-10");
  });

  it("apiErrorStatus maps CalendarError codes to proper HTTP statuses", () => {
    assert.equal(apiErrorStatus("not_found"), 404);
    assert.equal(apiErrorStatus("organization"), 422);
    assert.equal(apiErrorStatus("rate_limit"), 429);
    assert.equal(apiErrorStatus("unavailable"), 503);
  });

  it("escapes XML special characters in SVG titles and uses /u/:username for reserved names in shareCardSvg", () => {
    const maliciousDays: DayCount[] = [
      { date: '2026-10-01"><script>alert(1)</script>', count: 5, level: 1 },
    ];
    const heat = heatmapSvg(maliciousDays);
    assert.ok(!heat.includes("<script>"));
    const sky = skylineSvg(maliciousDays);
    assert.ok(!sky.includes("<script>"));

    const reservedCard = shareCardSvg({
      username: "docs",
      profile: {
        login: "docs",
        name: "Docs User",
        avatarUrl: "",
        htmlUrl: "",
        bio: null,
      },
      range: { from: "2026-09-01", to: "2026-09-03" },
      days: days([["2026-09-01", 3]]),
      stats: {
        total: 3,
        today: 3,
        week: 3,
        currentStreak: 1,
        longestStreak: 1,
        bestDay: { date: "2026-09-01", count: 3 },
        activeDays: 1,
      },
    });
    assert.match(reservedCard, /git-cadence\.grok\.me\/u\/docs/);
  });
});
