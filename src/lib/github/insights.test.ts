import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  busiestWeekday,
  consistency,
  hourHistogram,
  profilePermalink,
  repoMix,
  shareText,
  weekdayOf,
  weekdayTotals,
} from "./insights.ts";
import { normalizeUsername } from "./username.ts";

describe("normalizeUsername", () => {
  it("accepts a bare login and GitHub URLs", () => {
    assert.equal(normalizeUsername("ravidsrk"), "ravidsrk");
    assert.equal(normalizeUsername("@gaearon"), "gaearon");
    assert.equal(
      normalizeUsername("https://github.com/torvalds/linux"),
      "torvalds",
    );
    assert.equal(normalizeUsername("github.com/yyx990803/"), "yyx990803");
  });

  it("rejects junk", () => {
    assert.equal(normalizeUsername(""), null);
    assert.equal(normalizeUsername("has space"), null);
    assert.equal(normalizeUsername("-leading"), null);
  });
});

describe("weekday insights", () => {
  it("bins contribution dates by weekday", () => {
    const rows = weekdayTotals([
      { date: "2026-09-07", count: 2, level: 1 },
      { date: "2026-09-09", count: 5, level: 3 },
      { date: "2026-09-09", count: 1, level: 1 },
    ]);
    assert.equal(weekdayOf("2026-09-07"), 1);
    assert.equal(weekdayOf("2026-09-09"), 3);
    assert.equal(rows[1]?.count, 2);
    assert.equal(rows[3]?.count, 6);
    assert.equal(busiestWeekday(rows)?.label, "Wed");
  });
});

describe("consistency", () => {
  it("computes active-day ratio and typical volume", () => {
    const stats = consistency([
      { date: "2026-09-08", count: 0, level: 0 },
      { date: "2026-09-09", count: 4, level: 2 },
      { date: "2026-09-10", count: 6, level: 3 },
    ]);
    assert.equal(stats.totalDays, 3);
    assert.equal(stats.activeDays, 2);
    assert.equal(stats.activeRatio, 2 / 3);
    assert.equal(stats.avgOnActive, 5);
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
      "https://cadence.example/u/ravidsrk?d=2026-09-01&y=2026",
    );
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
    assert.match(text, /Ravindra · 8 public commits on 1 Sep 2026/);
    assert.match(text, /12-day streak/);
    assert.match(text, /1,204/);
  });
});
