import type { DayCount } from "./types.ts";
import { isValidIsoDate } from "./username.ts";

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i"));
  return match?.[1];
}

function parseCount(text: string): number {
  const trimmed = text.replace(/<[^>]+>/g, " ").trim();
  if (/^no\b/i.test(trimmed)) return 0;
  const match = trimmed.match(/([\d,]+)\s+contributions?/i) ?? trimmed.match(/^([\d,]+)/);
  if (!match?.[1]) return 0;
  return Number(match[1].replace(/,/g, ""));
}

export function parseContributionHtml(html: string): DayCount[] {
  const cells: { date: string; id: string; level: number }[] = [];
  const tdRe = /<td\b[^>]*>/gi;
  for (const match of html.matchAll(tdRe)) {
    const tag = match[0];
    if (!tag.includes("ContributionCalendar-day")) continue;
    const date = attr(tag, "data-date");
    const id = attr(tag, "id");
    if (!date || !isValidIsoDate(date) || !id) continue;
    const level = Number(attr(tag, "data-level") ?? 0);
    cells.push({ date, id, level: Number.isFinite(level) ? level : 0 });
  }

  const counts = new Map<string, number>();
  const tipRe = /<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi;
  for (const match of html.matchAll(tipRe)) {
    const id = attr(match[1] ?? "", "for");
    if (!id) continue;
    counts.set(id, parseCount(match[2] ?? ""));
  }

  // If cells report activity (data-level > 0) but no tooltips matched at all,
  // return empty so callers fall back to the JSON mirror instead of 0-counting.
  if (cells.some((c) => c.level > 0) && counts.size === 0) {
    return [];
  }

  const days: DayCount[] = [];
  const seen = new Set<string>();
  for (const cell of cells) {
    if (seen.has(cell.date)) continue;
    seen.add(cell.date);
    days.push({
      date: cell.date,
      count: counts.get(cell.id) ?? 0,
      level: Math.min(4, Math.max(0, cell.level)),
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

type JogruberResponse = {
  contributions?: Array<{ date?: string; count?: number; level?: number }>;
};

export function parseJogruber(json: JogruberResponse): DayCount[] {
  const days: DayCount[] = [];
  for (const row of json.contributions ?? []) {
    if (!row.date || !isValidIsoDate(row.date)) continue;
    days.push({
      date: row.date,
      count: Number(row.count) || 0,
      level: Math.min(4, Math.max(0, Number(row.level) || 0)),
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}
