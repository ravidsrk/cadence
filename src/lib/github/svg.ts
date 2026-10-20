import { format, parseISO } from "date-fns";
import { consistency } from "./insights.ts";
import { compactCount, escapeXml, heatColor, heatmapGrid } from "./layout.ts";
import type { CalendarPayload } from "./types.ts";
import { profilePath } from "./username.ts";

const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;

const LEVEL_FACES: Record<
  number,
  { top: string; left: string; right: string }
> = {
  0: { top: "#1c1c20", left: "#141417", right: "#101013" },
  1: { top: "#1f4738", left: "#17352a", right: "#11271f" },
  2: { top: "#2c6b53", left: "#21503e", right: "#183b2e" },
  3: { top: "#429873", left: "#327357", right: "#255540" },
  4: { top: "#6fd19c", left: "#54a178", right: "#3e7859" },
  5: { top: "#b8ffcf", left: "#8dd1a3", right: "#699e7b" },
};

const SIDE_DEFS: ReadonlyArray<{
  indices: [number, number];
  nx: number;
  nz: number;
  shade: "left" | "right";
}> = [
  { indices: [3, 2], nx: 0, nz: 1, shade: "left" },
  { indices: [1, 2], nx: 1, nz: 0, shade: "right" },
  { indices: [0, 1], nx: 0, nz: -1, shade: "left" },
  { indices: [0, 3], nx: -1, nz: 0, shade: "right" },
];

function pts(coords: Array<[number, number]>): string {
  return coords.map(([x, y]) => `${x},${y}`).join(" ");
}

export function skylineSvg(
  days: CalendarPayload["days"],
  opts: { width?: number; height?: number; standalone?: boolean } = {},
): string {
  const width = opts.width ?? 1072;
  const height = opts.height ?? 240;
  const standalone = opts.standalone ?? true;
  const { weeks } = heatmapGrid(days);
  const numWeeks = Math.max(weeks.length, 1);
  const numDays = 7;

  let maxCount = 1;
  for (const d of days) {
    if (d.count > maxCount) maxCount = d.count;
  }

  const yaw = (-26 * Math.PI) / 180;
  const pitch = (56 * Math.PI) / 180;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const cellStep = Math.min((width * 0.78) / numWeeks, 16.5);
  const cellSize = cellStep * 0.78;
  const half = cellSize / 2;
  const maxBarHeight = height * 0.44;

  const gridCx = ((numWeeks - 1) * cellStep) / 2;
  const gridCz = ((numDays - 1) * cellStep) / 2;
  const originX = width * 0.5;
  const originY = height * 0.64;

  function project(wx: number, wy: number, wz: number): [number, number] {
    const rx = (wx - gridCx) * cosY - (wz - gridCz) * sinY;
    const rz = (wx - gridCx) * sinY + (wz - gridCz) * cosY;
    const sx = originX + rx;
    const sy = originY + rz * sinP - wy * cosP;
    return [Number(sx.toFixed(1)), Number(sy.toFixed(1))];
  }

  const pad = cellStep * 0.85;
  const gx0 = -pad;
  const gx1 = (numWeeks - 1) * cellStep + pad;
  const gz0 = -pad;
  const gz1 = (numDays - 1) * cellStep + pad;
  const platCorners: Array<[number, number]> = [
    project(gx0, 0, gz0),
    project(gx1, 0, gz0),
    project(gx1, 0, gz1),
    project(gx0, 0, gz1),
  ];

  type ColumnItem = {
    depth: number;
    wx: number;
    wz: number;
    h: number;
    level: number;
    date: string;
    count: number;
  };

  const columns: ColumnItem[] = [];
  for (let w = 0; w < weeks.length; w++) {
    const week = weeks[w];
    if (!week) continue;
    for (let d = 0; d < 7; d++) {
      const cell = week[d];
      if (!cell) continue;
      const wx = w * cellStep;
      const wz = d * cellStep;
      const depth = (wx - gridCx) * sinY + (wz - gridCz) * cosY;
      const ratio = cell.count > 0 ? Math.pow(cell.count / maxCount, 0.72) : 0;
      const h =
        cell.count > 0 ? Math.max(5, ratio * maxBarHeight) : 2;
      columns.push({
        depth,
        wx,
        wz,
        h,
        level: cell.level,
        date: cell.date,
        count: cell.count,
      });
    }
  }
  columns.sort((a, b) => a.depth - b.depth);

  const visibleSides = SIDE_DEFS.filter(
    (side) => side.nx * sinY + side.nz * cosY > 0,
  );

  const columnNodes = columns
    .map((col) => {
      const palette = LEVEL_FACES[col.level] ?? LEVEL_FACES[0];
      const x0 = col.wx - half;
      const x1 = col.wx + half;
      const z0 = col.wz - half;
      const z1 = col.wz + half;

      const tCorners: Array<[number, number]> = [
        project(x0, col.h, z0),
        project(x1, col.h, z0),
        project(x1, col.h, z1),
        project(x0, col.h, z1),
      ];
      const bCorners: Array<[number, number]> = [
        project(x0, 0, z0),
        project(x1, 0, z0),
        project(x1, 0, z1),
        project(x0, 0, z1),
      ];

      const sidesSvg = visibleSides
        .map((side) => {
          const [i0, i1] = side.indices;
          const poly = [
            bCorners[i0]!,
            bCorners[i1]!,
            tCorners[i1]!,
            tCorners[i0]!,
          ];
          const fill = side.shade === "left" ? palette.left : palette.right;
          return `<polygon points="${pts(poly)}" fill="${fill}"/>`;
        })
        .join("");

      const strokeAttr =
        col.level >= 4
          ? ` stroke="#d4fae2" stroke-width="0.6"`
          : "";
      const topSvg = `<polygon points="${pts(tCorners)}" fill="${palette.top}"${strokeAttr}/>`;
      const safeCount = Number(col.count) || 0;
      return `<g><title>${safeCount} on ${escapeXml(col.date)}</title>${sidesSvg}${topSvg}</g>`;
    })
    .join("");

  const body = `<polygon points="${pts(platCorners)}" fill="#111114" stroke="#26262c" stroke-width="1"/>${columnNodes}`;
  if (!standalone) return body;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="3D contribution skyline">
  <rect width="${width}" height="${height}" rx="16" fill="#0c0c0d"/>
  ${body}
</svg>`;
}

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
          const safeCount = Number(day.count) || 0;
          return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(day.level)}"><title>${safeCount} on ${escapeXml(day.date)}</title></rect>`;
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

export function shareCardSvg(
  calendar: CalendarPayload,
  opts: { view?: "3d" | "2d" } = {},
): string {
  const view = opts.view ?? "3d";
  const width = 1200;
  const height = 630;
  const who = escapeXml(calendar.profile.name || calendar.profile.login);
  const login = escapeXml(calendar.profile.login);
  const canonicalPath = escapeXml(profilePath(calendar.profile.login));
  const total = calendar.stats.total.toLocaleString("en-IN");
  const streak = `${calendar.stats.currentStreak}d`;
  const active = String(calendar.stats.activeDays);
  const best = calendar.stats.bestDay
    ? `${calendar.stats.bestDay.count.toLocaleString("en-IN")} (${format(parseISO(calendar.stats.bestDay.date), "d MMM")})`
    : "—";
  const range = `${format(parseISO(calendar.range.from), "d MMM yyyy")} – ${format(parseISO(calendar.range.to), "d MMM yyyy")}`;
  const cadence = consistency(calendar.days);
  const pct = Math.round(cadence.activeRatio * 100);
  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = Number((ringC * (1 - cadence.activeRatio)).toFixed(1));

  const visualMarkup =
    view === "2d"
      ? `<g transform="translate(64 340)">${heatmapSvg(calendar.days, {
          cell: 14,
          gap: 3,
        })
          .replace(/<\?xml[^>]*>/, "")
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "")}</g>`
      : `<g transform="translate(64 316)">${skylineSvg(calendar.days, {
          width: 1072,
          height: 248,
          standalone: false,
        })}</g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <radialGradient id="skyGlow" cx="50%" cy="62%" r="48%">
      <stop offset="0%" stop-color="#3d8869" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0c0c0d" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#0c0c0d"/>
  <rect width="${width}" height="${height}" fill="url(#skyGlow)"/>
  <text x="64" y="64" fill="#66ba8e" font-size="14" font-weight="600" letter-spacing="4" font-family="ui-sans-serif, system-ui, sans-serif">CADENCE · ${view === "3d" ? "3D SKYLINE" : "YEAR MAP"}</text>
  <text x="64" y="120" fill="#ece8df" font-size="48" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif">${who}</text>
  <text x="64" y="154" fill="#9a958c" font-size="20" font-family="ui-monospace, SFMono-Regular, monospace">@${login} · ${escapeXml(range)}</text>

  <g transform="translate(1030 52)">
    <rect x="0" y="0" width="106" height="106" rx="20" fill="#141416" stroke="#242429"/>
    <circle cx="53" cy="46" r="${ringR}" fill="none" stroke="#1c1c20" stroke-width="8"/>
    <circle cx="53" cy="46" r="${ringR}" fill="none" stroke="#66ba8e" stroke-width="8" stroke-linecap="round" stroke-dasharray="${ringC.toFixed(1)}" stroke-dashoffset="${ringOffset}" transform="rotate(-90 53 46)"/>
    <text x="53" y="52" text-anchor="middle" fill="#ece8df" font-size="18" font-weight="600" font-family="ui-monospace, SFMono-Regular, monospace">${pct}%</text>
    <text x="53" y="98" text-anchor="middle" fill="#9a958c" font-size="10" letter-spacing="1.5" font-family="ui-sans-serif, system-ui, sans-serif">CONSISTENCY</text>
  </g>

  <g transform="translate(64 188)">
    <rect x="0" y="0" width="248" height="96" rx="16" fill="#141416" stroke="#242429"/>
    <text x="20" y="30" fill="#9a958c" font-size="12" letter-spacing="1.5" font-family="ui-sans-serif, system-ui, sans-serif">STREAK</text>
    <text x="20" y="72" fill="#9ad4b1" font-size="36" font-weight="600" font-family="ui-monospace, SFMono-Regular, monospace">${streak}</text>

    <rect x="268" y="0" width="268" height="96" rx="16" fill="#141416" stroke="#242429"/>
    <text x="288" y="30" fill="#9a958c" font-size="12" letter-spacing="1.5" font-family="ui-sans-serif, system-ui, sans-serif">CONTRIBUTIONS</text>
    <text x="288" y="72" fill="#ece8df" font-size="36" font-weight="600" font-family="ui-monospace, SFMono-Regular, monospace">${total}</text>

    <rect x="556" y="0" width="236" height="96" rx="16" fill="#141416" stroke="#242429"/>
    <text x="576" y="30" fill="#9a958c" font-size="12" letter-spacing="1.5" font-family="ui-sans-serif, system-ui, sans-serif">ACTIVE DAYS</text>
    <text x="576" y="72" fill="#ece8df" font-size="36" font-weight="600" font-family="ui-monospace, SFMono-Regular, monospace">${active}</text>

    <rect x="812" y="0" width="260" height="96" rx="16" fill="#141416" stroke="#242429"/>
    <text x="832" y="30" fill="#9a958c" font-size="12" letter-spacing="1.5" font-family="ui-sans-serif, system-ui, sans-serif">BEST DAY</text>
    <text x="832" y="70" fill="#ece8df" font-size="26" font-weight="600" font-family="ui-monospace, SFMono-Regular, monospace">${escapeXml(best)}</text>
  </g>

  ${visualMarkup}

  <text x="64" y="596" fill="#9a958c" font-size="15" font-family="ui-monospace, SFMono-Regular, monospace">git-cadence.grok.me${canonicalPath}</text>
  <text x="1136" y="596" text-anchor="end" fill="#66ba8e" font-size="14" font-family="ui-monospace, SFMono-Regular, monospace">${calendar.stats.longestStreak}d longest streak</text>
</svg>`;
}
