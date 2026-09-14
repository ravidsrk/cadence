import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarCsv } from "./csv.ts";
import { quietStats } from "./gaps.ts";
import { compactCount, escapeXml, shiftDate } from "./layout.ts";
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
