import type { DayCount } from "./types";

export function calendarCsv(days: DayCount[]): string {
  const lines = ["date,count,level"];
  for (const day of days) {
    lines.push(`${day.date},${day.count},${day.level}`);
  }
  return `${lines.join("\n")}\n`;
}

export function calendarJson(input: {
  username: string;
  range: { from: string; to: string };
  days: DayCount[];
}): string {
  return `${JSON.stringify(input, null, 2)}\n`;
}
