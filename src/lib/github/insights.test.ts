import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPeakMonthLabel,
  monthRollup,
  peakMonthRollup,
} from "./gaps.ts";
import {
  busiestWeekday,
  consistency,
  hourHistogram,
  orderWeekdaysMonFirst,
  profilePermalink,
  repoMix,
  shareText,
  weekdayOf,
  weekdayTotals,
} from "./insights.ts";
import { compactCount, niceAxisTicks, shiftDate } from "./layout.ts";
import { cadenceSearchFromState, validateCadenceSearch } from "./search.ts";
import {
  assignLevels,
  bucketIntensityCounts,
  computeStats,
  INTENSITY_THRESHOLDS,
  intensityLevelForCount,
} from "./stats.ts";
import {
  isReservedRoute,
  isValidIsoDate,
  normalizeUsername,
  parseGithubUsername,
  profilePath,
  profileRoute,
  RESERVED_ROUTES,
  resolveSelectedDate,
} from "./username.ts";

describe("parseGithubUsername & RESERVED_ROUTES", () => {
  it("parses valid bare usernames, @handles, GitHub URLs, and Cadence URLs", () => {
    assert.deepEqual(parseGithubUsername("ravidsrk"), {
      ok: true,
      username: "ravidsrk",
      isReserved: false,
    });
    assert.deepEqual(parseGithubUsername("@ravidsrk"), {
      ok: true,
      username: "ravidsrk",
      isReserved: false,
    });
    assert.deepEqual(parseGithubUsername("  ravidsrk  "), {
      ok: true,
      username: "ravidsrk",
      isReserved: false,
    });
    assert.deepEqual(parseGithubUsername("github.com/ravidsrk"), {
      ok: true,
      username: "ravidsrk",
      isReserved: false,
    });
    assert.deepEqual(parseGithubUsername("https://github.com/ravidsrk"), {
      ok: true,
      username: "ravidsrk",
      isReserved: false,
    });
    assert.deepEqual(
      parseGithubUsername("https://www.github.com/ravidsrk/repo"),
      {
        ok: true,
        username: "ravidsrk",
        isReserved: false,
      },
    );
    assert.deepEqual(
      parseGithubUsername("https://git-cadence.grok.me/ravidsrk"),
      {
        ok: true,
        username: "ravidsrk",
        isReserved: false,
      },
    );
    assert.deepEqual(
      parseGithubUsername("https://git-cadence.grok.me/u/ravidsrk"),
      {
        ok: true,
        username: "ravidsrk",
        isReserved: false,
      },
    );
  });

  it("flags reserved names as isReserved: true and routes them to /u/:username", () => {
    assert.deepEqual(parseGithubUsername("docs"), {
      ok: true,
      username: "docs",
      isReserved: true,
    });
    assert.equal(profilePath("docs"), "/u/docs");
    assert.equal(profilePath("ravidsrk"), "/ravidsrk");

    const requiredReserved = [
      "compare",
      "board",
      "docs",
      "api",
      "about",
      "privacy",
      "terms",
      "login",
      "settings",
      "recap",
      "u",
      "static",
      "assets",
      "favicon.ico",
      "robots.txt",
      "sitemap.xml",
      "og",
      "health",
      "embed",
    ];
    for (const r of requiredReserved) {
      assert.equal(
        RESERVED_ROUTES.has(r),
        true,
        `Expected ${r} to be in RESERVED_ROUTES`,
      );
      assert.equal(isReservedRoute(r), true);
      assert.equal(isReservedRoute(r.toUpperCase()), true);
    }
  });

  it("rejects empty, malformed, and non-GitHub inputs with human-readable errors", () => {
    const invalidInputs = [
      "",
      "   ",
      "-bad",
      "bad-",
      "bad--name",
      "bad name",
      "a".repeat(40),
      "https://gitlab.com/foo",
    ];
    for (const input of invalidInputs) {
      const res = parseGithubUsername(input);
      assert.equal(res.ok, false, `Expected "${input}" to fail validation`);
      if (!res.ok) {
        assert.ok(res.error.length > 0);
      }
    }
  });

  it("normalizeUsername remains compatible", () => {
    assert.equal(normalizeUsername("ravidsrk"), "ravidsrk");
    assert.equal(normalizeUsername("@gaearon"), "gaearon");
    assert.equal(
      normalizeUsername("https://github.com/torvalds/linux"),
      "torvalds",
    );
    assert.equal(normalizeUsername("github.com/yyx990803/"), "yyx990803");
    assert.equal(normalizeUsername(""), null);
    assert.equal(normalizeUsername("has space"), null);
    assert.equal(normalizeUsername("-leading"), null);
  });
});

describe("weekday insights", () => {
  it("bins contribution dates by weekday and orders Mon-Sun", () => {
    const rows = weekdayTotals([
      { date: "2026-09-06", count: 3, level: 1 }, // Sun
      { date: "2026-09-07", count: 2, level: 1 }, // Mon
      { date: "2026-09-09", count: 5, level: 2 }, // Wed
      { date: "2026-09-09", count: 1, level: 1 }, // Wed
    ]);
    assert.equal(weekdayOf("2026-09-07"), 1);
    assert.equal(weekdayOf("2026-09-09"), 3);
    assert.equal(rows[1]?.count, 2);
    assert.equal(rows[3]?.count, 6);
    assert.equal(busiestWeekday(rows)?.label, "Wed");

    const monFirst = orderWeekdaysMonFirst(rows);
    assert.equal(monFirst[0]?.label, "Mon");
    assert.equal(monFirst[6]?.label, "Sun");
    assert.equal(monFirst[6]?.count, 3);
  });
});

describe("consistency & daily-pace calculation", () => {
  it("computes active-day ratio, per-active-day pace, and per-calendar-day pace", () => {
    const stats = consistency([
      { date: "2026-09-08", count: 0, level: 0 },
      { date: "2026-09-09", count: 6, level: 1 },
      { date: "2026-09-10", count: 9, level: 1 },
    ]);
    assert.equal(stats.totalDays, 3);
    assert.equal(stats.activeDays, 2);
    assert.equal(stats.activeRatio, 2 / 3);
    assert.equal(stats.avgOnActive, 7.5); // 15 / 2 active days
    assert.equal(stats.avgPerDay, 5); // 15 / 3 calendar days
  });
});

describe("intensity bucketing", () => {
  it("assigns 6 log-spaced thresholds (0, 1-9, 10-49, 50-199, 200-499, 500+)", () => {
    assert.equal(INTENSITY_THRESHOLDS.length, 6);
    assert.equal(intensityLevelForCount(0), 0);
    assert.equal(intensityLevelForCount(1), 1);
    assert.equal(intensityLevelForCount(9), 1);
    assert.equal(intensityLevelForCount(10), 2);
    assert.equal(intensityLevelForCount(49), 2);
    assert.equal(intensityLevelForCount(50), 3);
    assert.equal(intensityLevelForCount(199), 3);
    assert.equal(intensityLevelForCount(200), 4);
    assert.equal(intensityLevelForCount(499), 4);
    assert.equal(intensityLevelForCount(500), 5);
    assert.equal(intensityLevelForCount(950), 5);

    const assigned = assignLevels([
      { date: "2026-10-01", count: 0 },
      { date: "2026-10-02", count: 5 },
      { date: "2026-10-03", count: 25 },
      { date: "2026-10-04", count: 120 },
      { date: "2026-10-05", count: 350 },
      { date: "2026-10-06", count: 620 },
    ]);
    assert.deepEqual(
      assigned.map((d) => d.level),
      [0, 1, 2, 3, 4, 5],
    );

    const buckets = bucketIntensityCounts(assigned);
    assert.deepEqual(
      buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct })),
      [
        { label: "Rest", count: 1, pct: 17 },
        { label: "Light", count: 1, pct: 17 },
        { label: "Steady", count: 1, pct: 17 },
        { label: "High", count: 1, pct: 17 },
        { label: "Very high", count: 1, pct: 17 },
        { label: "Peak", count: 1, pct: 17 },
      ],
    );
  });

  it("produces distinct distributions for low-activity vs high-activity users", () => {
    const lightUser = bucketIntensityCounts(
      assignLevels([
        { date: "2026-10-01", count: 0 },
        { date: "2026-10-02", count: 2 },
        { date: "2026-10-03", count: 4 },
        { date: "2026-10-04", count: 0 },
      ]),
    );
    const heavyUser = bucketIntensityCounts(
      assignLevels([
        { date: "2026-10-01", count: 240 },
        { date: "2026-10-02", count: 540 },
        { date: "2026-10-03", count: 180 },
        { date: "2026-10-04", count: 610 },
      ]),
    );
    assert.equal(lightUser.find((b) => b.label === "Peak")?.count, 0);
    assert.equal(lightUser.find((b) => b.label === "Light")?.count, 2);
    assert.equal(heavyUser.find((b) => b.label === "Peak")?.count, 2);
    assert.equal(heavyUser.find((b) => b.label === "Very high")?.count, 1);
    assert.equal(heavyUser.find((b) => b.label === "High")?.count, 1);
  });
});

describe("partial months & repeating month labels", () => {
  it("marks both leading and trailing incomplete months as partial, disambiguates repeating months, and formats Peak label", () => {
    const days = assignLevels([
      ...Array.from({ length: 13 }, (_, i) => ({
        date: `2025-10-${String(i + 19).padStart(2, "0")}`,
        count: 10,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
        count: 15,
      })),
      ...Array.from({ length: 17 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        count: 655,
      })),
    ]);
    const months = monthRollup(days, "2026-10-17");
    assert.equal(months.length, 3);
    assert.equal(months[0]?.key, "2025-10");
    assert.equal(months[0]?.isPartial, true);
    assert.equal(months[0]?.shortLabel, "Oct '25");
    assert.equal(months[1]?.key, "2026-09");
    assert.equal(months[1]?.isPartial, false);
    assert.equal(months[1]?.shortLabel, "Sep");
    assert.equal(months[2]?.key, "2026-10");
    assert.equal(months[2]?.isPartial, true);
    assert.equal(months[2]?.shortLabel, "Oct '26");

    const overallPeak = peakMonthRollup(months);
    assert.equal(overallPeak?.key, "2026-10");
    assert.equal(overallPeak?.isPartial, true);
    assert.equal(
      formatPeakMonthLabel(overallPeak),
      "Peak: Oct '26 · 11,135 (partial)",
    );

    const completeOnlyPeak = peakMonthRollup(months, { completeOnly: true });
    assert.equal(completeOnlyPeak?.key, "2026-09");
    assert.equal(completeOnlyPeak?.isPartial, false);

    const dec2024Days = assignLevels(
      Array.from({ length: 31 }, (_, i) => ({
        date: `2024-12-${String(i + 1).padStart(2, "0")}`,
        count: 1,
      })),
    );
    const dec2024Months = monthRollup(dec2024Days, "2026-10-17");
    assert.equal(dec2024Months[0]?.isPartial, false);
  });
});

describe("nice axis ticks", () => {
  it("computes round nice tick values for chart y-axes", () => {
    const t1 = niceAxisTicks(1420);
    assert.deepEqual(t1.ticks, [0, 500, 1000, 1500]);
    assert.deepEqual(t1.ticks.map(compactCount), ["0", "500", "1k", "1.5k"]);
  });
});

describe("streak values", () => {
  it("computes current streak, longest streak, longest streak date range, active days, and best day", () => {
    const days = assignLevels([
      { date: "2026-10-10", count: 5 },
      { date: "2026-10-11", count: 8 },
      { date: "2026-10-12", count: 12 },
      { date: "2026-10-13", count: 4 },
      { date: "2026-10-14", count: 0 },
      { date: "2026-10-15", count: 6 },
      { date: "2026-10-16", count: 20 },
      { date: "2026-10-17", count: 9 },
    ]);
    const stats = computeStats(days, "2026-10-17");
    assert.equal(stats.longestStreak, 4);
    assert.deepEqual(stats.longestStreakRange, {
      start: "2026-10-10",
      end: "2026-10-13",
    });
    assert.equal(stats.currentStreak, 3);
    assert.equal(stats.activeDays, 7);
    assert.equal(stats.today, 9);
    assert.deepEqual(stats.bestDay, { date: "2026-10-16", count: 20 });
  });
});

describe("day-selection sync & URL state", () => {
  it("steps between days on the map and syncs selected date, range, and 3D view in URL search params", () => {
    const days = assignLevels([
      { date: "2026-10-15", count: 4 },
      { date: "2026-10-16", count: 12 },
      { date: "2026-10-17", count: 9 },
    ]);
    const prev = shiftDate(days, "2026-10-17", -1);
    assert.equal(prev, "2026-10-16");
    const next = shiftDate(days, prev, 1);
    assert.equal(next, "2026-10-17");

    const search = cadenceSearchFromState({
      today: "2026-10-17",
      selectedDate: prev,
      year: 2026,
      view: "3d",
    });
    assert.deepEqual(search, { d: "2026-10-16", range: 2026, view: "3d" });

    const validated = validateCadenceSearch({
      d: "2026-10-16",
      range: "2026",
      view: "3d",
    });
    assert.deepEqual(validated, { d: "2026-10-16", range: 2026, view: "3d" });

    // Past year default date (2024-12-31) omits ?d= from URL search params
    const pastSearchDefault = cadenceSearchFromState({
      today: "2026-10-17",
      selectedDate: "2024-12-31",
      year: 2024,
      view: "2d",
    });
    assert.deepEqual(pastSearchDefault, { range: 2024 });

    // Past year streak at end of range (allowYesterdayFallback = false)
    const pastDays = assignLevels([
      { date: "2024-12-29", count: 4 },
      { date: "2024-12-30", count: 2 },
      { date: "2024-12-31", count: 1 },
    ]);
    const pastStats = computeStats(pastDays, "2024-12-31", false);
    assert.equal(pastStats.currentStreak, 3);
  });
});

describe("commit slices", () => {
  it("groups repos and hours", () => {
    const mix = repoMix([
      { repo: "a/one" },
      { repo: "b/two" },
      { repo: "a/one" },
    ]);
    assert.deepEqual(mix, [
      { repo: "a/one", count: 2 },
      { repo: "b/two", count: 1 },
    ]);
    const hours = hourHistogram([
      "2026-09-10T04:10:00+05:30",
      "2026-09-10T04:40:00+05:30",
    ]);
    assert.equal(
      hours.reduce((sum, n) => sum + n, 0),
      2,
    );
  });
});

describe("share helpers", () => {
  it("builds a permalink and caption", () => {
    const url = profilePermalink({
      origin: "https://cadence.example",
      username: "ravidsrk",
      today: "2026-09-10",
      selectedDate: "2026-09-01",
      year: 2026,
    });
    assert.equal(
      url,
      "https://cadence.example/ravidsrk?d=2026-09-01&range=2026",
    );
    const reservedUrl = profilePermalink({
      origin: "https://cadence.example",
      username: "docs",
      today: "2026-09-10",
      selectedDate: "2026-09-10",
    });
    assert.equal(reservedUrl, "https://cadence.example/u/docs");
    const text = shareText({
      login: "ravidsrk",
      name: "Ravindra",
      streak: 12,
      total: 1204,
      rangeLabel: "last 12 months",
      dayCount: 8,
      dayLabel: "1 Sep 2026",
      url,
    });
    assert.match(text, /Ravindra · 8 commits on 1 Sep 2026/);
    assert.match(text, /12-day streak/);
    assert.match(text, /1,204/);
  });

  it("validates strict ISO calendar dates, resolves out-of-range selected dates, and supports extended GitHub/Cadence URL paths", () => {
    assert.equal(isValidIsoDate("2026-10-17"), true);
    assert.equal(isValidIsoDate("2024-02-29"), true); // leap year
    assert.equal(isValidIsoDate("2026-02-29"), false); // non-leap year
    assert.equal(isValidIsoDate("2026-02-99"), false);
    assert.equal(isValidIsoDate("2026-13-01"), false);
    assert.equal(isValidIsoDate("2026-00-10"), false);

    assert.deepEqual(
      validateCadenceSearch({ d: "2026-02-99", range: "2026", view: "2d" }),
      { range: 2026, view: "2d" },
    );

    assert.equal(
      resolveSelectedDate("2026-10-16", undefined, "2026-10-17"),
      "2026-10-16",
    );
    assert.equal(
      resolveSelectedDate("2099-01-01", undefined, "2026-10-17"),
      "2026-10-17",
    );
    assert.equal(
      resolveSelectedDate(undefined, 2024, "2026-10-17"),
      "2024-12-31",
    );
    assert.equal(
      resolveSelectedDate("2025-05-05", 2024, "2026-10-17"),
      "2024-12-31",
    );

    assert.equal(profileRoute("ravidsrk"), "/$username");
    assert.equal(profileRoute("docs"), "/u/$username");

    assert.deepEqual(
      parseGithubUsername("https://github.com/users/ravidsrk/contributions"),
      { ok: true, username: "ravidsrk", isReserved: false },
    );
    assert.deepEqual(
      parseGithubUsername("https://github.com/orgs/vercel/people"),
      { ok: true, username: "vercel", isReserved: false },
    );
    assert.deepEqual(
      parseGithubUsername("https://git-cadence.grok.me/embed/ravidsrk"),
      { ok: true, username: "ravidsrk", isReserved: false },
    );
  });
});
