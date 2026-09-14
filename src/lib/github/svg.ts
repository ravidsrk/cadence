import { format, parseISO } from "date-fns";
import { compactCount, escapeXml, heatColor, heatmapGrid } from "./layout";
import type { CalendarPayload } from "./types";

const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;

export function heatmapSvg(
  days: CalendarPayload["days"],
  opts: { cell?: number; gap?: number } = {},
): string {
  const cell = opts.cell ?? 11;
  const gap = opts.gap ?? 3;
  const step = cell + gap;
  const { weeks, monthLabels } = heatmapGrid(days);
  const labelW = 28;
  const top = 18;
  const width = labelW + weeks.length * step + 8;
  const height = top + 7 * step + 8;
  const months = monthLabels
    .map(
      (item) =>
        `<text x="${labelW + item.index * step}" y="12" fill="#9a958c" font-size="10" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(item.label)}</text>`,
    )
    .join("");
  const labels = WEEKDAYS.map((label, i) =>
    label
      ? `<text x="0" y="${top + i * step + cell - 1}" fill="#9a958c" font-size="9" font-family="ui-sans-serif, system-ui, sans-serif">${label}</text>`
      : "",
  ).join("");
  const rects = weeks
    .map((week, wi) =>
      week
        .map((day, di) => {
          if (!day) return "";
          const x = labelW + wi * step;
          const y = top + di * step;
          return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(day.level)}"><title>${day.count} on ${day.date}</title></rect>`;
        })
        .join(""),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${months}${labels}${rects}</svg>`;
}

export function badgeSvg(input: {
  login: string;
  streak: number;
  today: number;
  total: number;
}): string {
  const left = "Cadence";
  const right = `${input.streak}d · ${compactCount(input.today)} today · ${compactCount(input.total)}`;
  const leftW = 64;
  const rightW = Math.max(132, Math.round(10 + right.length * 6.2));
  const width = leftW + rightW;
  const label = `${input.login}: ${right}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <rect width="${leftW}" height="20" fill="#141416"/>
  <rect x="${leftW}" width="${rightW}" height="20" fill="#1d3d32"/>
  <rect width="${width}" height="20" fill="none" stroke="#2f6b54"/>
  <text x="${leftW / 2}" y="14" text-anchor="middle" fill="#ece8df" font-size="11" font-family="ui-sans-serif, system-ui, sans-serif">${left}</text>
  <text x="${leftW + rightW / 2}" y="14" text-anchor="middle" fill="#9ad4b1" font-size="11" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(right)}</text>
</svg>`;
}

export function shareCardSvg(calendar: CalendarPayload): string {
  const width = 1200;
  const height = 630;
  const who = escapeXml(calendar.profile.name || calendar.profile.login);
  const login = escapeXml(calendar.profile.login);
  const total = calendar.stats.total.toLocaleString("en-IN");
  const streak = String(calendar.stats.currentStreak);
  const active = String(calendar.stats.activeDays);
  const best = calendar.stats.bestDay
    ? `${calendar.stats.bestDay.count.toLocaleString("en-IN")} on ${format(parseISO(calendar.stats.bestDay.date), "d MMM")}`
    : "—";
  const range = `${format(parseISO(calendar.range.from), "d MMM yyyy")} – ${format(parseISO(calendar.range.to), "d MMM yyyy")}`;
  const inner = heatmapSvg(calendar.days, { cell: 9, gap: 2 })
    .replace(/<\?xml[^>]*>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <rect width="${width}" height="${height}" fill="#0c0c0d"/>
  <text x="64" y="72" fill="#9a958c" font-size="16" letter-spacing="4" font-family="ui-sans-serif, system-ui, sans-serif">CADENCE</text>
  <text x="64" y="132" fill="#ece8df" font-size="52" font-family="ui-sans-serif, system-ui, sans-serif">${who}</text>
  <text x="64" y="168" fill="#9a958c" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif">@${login} · ${escapeXml(range)}</text>
  <g>
    <text x="64" y="230" fill="#9a958c" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">STREAK</text>
    <text x="64" y="272" fill="#9ad4b1" font-size="40" font-family="ui-monospace, SFMono-Regular, monospace">${streak}</text>
    <text x="280" y="230" fill="#9a958c" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">CONTRIBUTIONS</text>
    <text x="280" y="272" fill="#ece8df" font-size="40" font-family="ui-monospace, SFMono-Regular, monospace">${total}</text>
    <text x="620" y="230" fill="#9a958c" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">ACTIVE DAYS</text>
    <text x="620" y="272" fill="#ece8df" font-size="40" font-family="ui-monospace, SFMono-Regular, monospace">${active}</text>
    <text x="860" y="230" fill="#9a958c" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">BEST DAY</text>
    <text x="860" y="272" fill="#ece8df" font-size="28" font-family="ui-monospace, SFMono-Regular, monospace">${escapeXml(best)}</text>
  </g>
  <g transform="translate(64 330)">${inner}</g>
  <text x="64" y="590" fill="#9a958c" font-size="16" font-family="ui-sans-serif, system-ui, sans-serif">git-cadence.grok.me/u/${login}</text>
</svg>`;
}
