import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareDelta } from "./compare.ts";
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
