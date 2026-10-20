import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { PauseCircle, RotateCcw, TrendingUp } from "lucide-react";
import {
  formatPeakMonthLabel,
  monthRollup,
  peakMonthRollup,
  type QuietStats,
} from "@/lib/github/gaps";
import type { WeekdayRow } from "@/lib/github/insights";
import { compactCount, heatmapGrid, niceAxisTicks } from "@/lib/github/layout";
import {
  bucketIntensityCounts,
  intensityLevelForCount,
} from "@/lib/github/stats";
import type { DayCount, LanguageMixItem } from "@/lib/github/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./count-pair";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

const HEAT_COLORS = [
  "var(--color-heat-0)",
  "var(--color-heat-1)",
  "var(--color-heat-2)",
  "var(--color-heat-3)",
  "var(--color-heat-4)",
  "var(--color-heat-5)",
] as const;

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  HTML: "#e34c26",
  CSS: "#663399",
  Shell: "#89e051",
  "C++": "#f34b7d",
  C: "#555555",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Zig: "#ec915c",
  Svelte: "#ff3e00",
  Vue: "#41b883",
  Astro: "#ff5a03",
  MDX: "#fcb32c",
};

const FALLBACK_PALETTE = [
  "#39d353",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#60a5fa",
];

function languageColor(lang: string, index: number): string {
  return (
    LANGUAGE_COLORS[lang] ??
    FALLBACK_PALETTE[index % FALLBACK_PALETTE.length] ??
    "#39d353"
  );
}

/**
 * Radial SVG gauge for consistency % with combined "X of Y days" label and Daily pace card.
 */
export function ConsistencyRing({
  activeRatio,
  activeDays,
  totalDays,
  avgOnActive,
  avgPerDay,
  days,
}: {
  activeRatio: number;
  activeDays: number;
  totalDays: number;
  avgOnActive: number;
  avgPerDay?: number;
  days: DayCount[];
}) {
  const pct = Math.min(100, Math.max(0, Math.round(activeRatio * 100)));
  const size = 136;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  const totalContribs = days.reduce((sum, d) => sum + d.count, 0);
  const calendarPace =
    avgPerDay ?? (totalDays > 0 ? totalContribs / totalDays : 0);

  const months = monthRollup(days).slice(-12);
  const innerRadius = radius - 14;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const segmentCount = Math.max(1, months.length);
  const gapAngle = 4;
  const segmentLength =
    innerCircumference / segmentCount -
    (gapAngle / 360) * innerCircumference;

  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative size-28 shrink-0 sm:size-[124px]">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="size-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-heat-0)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-heat-4)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
            {months.map((m, idx) => {
              const ratio = m.days > 0 ? m.active / m.days : 0;
              const level =
                ratio === 0
                  ? 0
                  : ratio < 0.25
                    ? 1
                    : ratio < 0.5
                      ? 2
                      : ratio < 0.75
                        ? 3
                        : 4;
              const offset =
                innerCircumference * (1 - idx / segmentCount);
              return (
                <circle
                  key={m.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={innerRadius}
                  fill="none"
                  stroke={HEAT_COLORS[level]}
                  strokeWidth={4}
                  strokeDasharray={`${Math.max(2, segmentLength)} ${innerCircumference}`}
                  strokeDashoffset={offset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className="font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
              {pct}
              <span className="text-sm text-muted-foreground sm:text-base">%</span>
            </span>
            <span className="mt-1 text-[10px] font-medium text-muted-foreground">
              Active rate
            </span>
          </div>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatCount(activeDays)} of {formatCount(totalDays)} days
        </span>
      </div>

      <div className="min-w-0 flex-1 rounded-xl bg-secondary/50 p-3 shadow-[var(--shadow-border)] sm:p-3.5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-accent" />
            <span>Daily pace</span>
          </span>
          <InfoTooltip text="Average contributions per active day (days with at least 1 contribution) alongside the average across all calendar days in the period." />
        </div>
        <p className="mt-2 font-mono text-xl leading-none font-semibold tabular-nums sm:text-2xl">
          {avgOnActive.toFixed(1)}{" "}
          <span className="font-sans text-xs font-normal text-muted-foreground">
            per active day
          </span>
        </p>
        <p className="mt-1.5 font-mono text-xs text-muted-foreground tabular-nums">
          {calendarPace.toFixed(1)} per calendar day
        </p>
      </div>
    </div>
  );
}

/**
 * Stacked bar + 6-bucket breakdown of log-spaced intensity thresholds (0, 1–9, 10–49, 50–199, 200–499, 500+).
 */
export function IntensityBreakdown({ days }: { days: DayCount[] }) {
  const total = Math.max(1, days.length);
  const buckets = bucketIntensityCounts(days);
  const displayOrder = [...buckets].reverse(); // Peak (5) -> Rest (0)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <span>Intensity mix</span>
          <InfoTooltip text="Groups calendar days into log-spaced daily contribution brackets: Rest (0), Light (1–9), Steady (10–49), High (50–199), Very high (200–499), and Peak (500+)." />
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          Log-spaced brackets
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-heat-0 p-0.5 shadow-[var(--shadow-border)]">
        {displayOrder.map((b) => {
          const widthPct = (b.count / total) * 100;
          if (widthPct <= 0) return null;
          return (
            <div
              key={b.level}
              title={`${b.label} (${b.rangeLabel}): ${b.count} days (${b.pct}%)`}
              style={{
                width: `${widthPct}%`,
                backgroundColor: HEAT_COLORS[b.level],
              }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {displayOrder.map((b) => (
          <div
            key={b.level}
            data-intensity-bucket={b.label.toLowerCase()}
            className="flex min-w-0 flex-col justify-between rounded-lg bg-secondary/40 px-2.5 py-2 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: HEAT_COLORS[b.level] }}
                />
                <span className="truncate text-xs font-medium text-foreground/95">
                  {b.label}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                {b.rangeLabel}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-xs font-medium tabular-nums">
              {b.count}d{" "}
              <span className="text-muted-foreground">({b.pct}%)</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Visual weekly barcode ribbon showing active streaks and quiet gaps with month tick labels and per-segment tooltips.
 */
export function StreakBarcode({
  days,
  quiet,
  onSelectDate,
}: {
  days: DayCount[];
  quiet: QuietStats;
  longestStreak?: number;
  currentStreak?: number;
  onSelectDate?: (iso: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { weeks, monthLabels } = heatmapGrid(days);

  const buckets = weeks
    .map((week, weekIndex) => {
      const valid = week.filter((d): d is DayCount => Boolean(d));
      if (valid.length === 0) return null;
      let maxLevel = 0;
      let active = 0;
      let total = 0;
      let inGap = false;
      for (const d of valid) {
        const lvl = intensityLevelForCount(d.count);
        if (lvl > maxLevel) maxLevel = lvl;
        if (d.count > 0) active += 1;
        total += d.count;
        if (
          quiet.longestGap &&
          d.date >= quiet.longestGap.start &&
          d.date <= quiet.longestGap.end
        ) {
          inGap = true;
        }
      }
      const startDate = valid[0]!.date;
      const endDate = valid[valid.length - 1]!.date;
      const rangeText =
        startDate === endDate
          ? format(parseISO(startDate), "d MMM yyyy")
          : `${format(parseISO(startDate), "d MMM")} – ${format(parseISO(endDate), "d MMM yyyy")}`;
      return {
        weekIndex,
        date: startDate,
        endDate,
        rangeText,
        dayCount: valid.length,
        active,
        total,
        maxLevel,
        inGap,
      };
    })
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  const numWeeks = Math.max(1, buckets.length);
  const hoveredBucket = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  const ribbonTicks = (() => {
    const raw = monthLabels.map((m) => ({
      ...m,
      pct: (m.index / numWeeks) * 100,
    }));
    if (raw.length <= 2) return raw;
    const last = raw[raw.length - 1]!;
    const kept: typeof raw = [];
    let lastPct = -100;
    for (let i = 0; i < raw.length - 1; i++) {
      const item = raw[i]!;
      const prevHasYear = kept[kept.length - 1]?.label.includes("'") ?? false;
      const minGap = prevHasYear ? 15 : 10;
      if (item.pct - lastPct < minGap) continue;
      if (Math.min(last.pct, 85) - item.pct < 12) continue;
      kept.push(item);
      lastPct = item.pct;
    }
    kept.push(last);
    return kept;
  })();

  return (
    <div
      className="relative space-y-2"
      data-streak-ribbon="true"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-muted-foreground">
            Streak &amp; cadence ribbon
          </span>
          <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            1 bar = 1 week
          </span>
        </div>
        {quiet.longestGap && quiet.longestGap.days > 0 ? (
          <button
            type="button"
            onClick={() => onSelectDate?.(quiet.longestGap!.start)}
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground"
            title={`Longest pause: ${quiet.longestGap.start} to ${quiet.longestGap.end}`}
          >
            <PauseCircle className="size-3" />
            Max pause: {quiet.longestGap.days}d
          </button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            Max pause: 0d
          </span>
        )}
      </div>

      <div className="relative">
        <div className="flex h-9 items-end gap-[2px] rounded-xl bg-secondary/40 p-1.5 shadow-[var(--shadow-border)]">
          {buckets.map((b, idx) => {
            const heightPct =
              b.active === 0
                ? 22
                : Math.max(35, Math.round((b.active / b.dayCount) * 100));
            const tipText = `${b.rangeText} · ${b.active}/${b.dayCount} active days · ${formatCount(b.total)} contributions`;
            return (
              <button
                key={b.date}
                type="button"
                data-ribbon-segment={b.date}
                onClick={() => onSelectDate?.(b.date)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                title={tipText}
                aria-label={tipText}
                className="group relative flex h-full flex-1 items-end rounded-[2px] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <span
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: HEAT_COLORS[b.maxLevel] ?? HEAT_COLORS[0],
                  }}
                  className={cn(
                    "w-full rounded-[2px] transition-transform duration-150 group-hover:scale-y-110",
                    hoveredIdx === idx && "ring-1 ring-white",
                    b.inGap && b.maxLevel === 0 && "opacity-45",
                  )}
                />
              </button>
            );
          })}
        </div>

        {hoveredBucket ? (
          <div
            data-ribbon-tooltip="true"
            className="pointer-events-none absolute -top-8 right-0 z-20 rounded-lg bg-foreground px-2.5 py-1 font-mono text-[11px] text-background shadow-md tabular-nums"
          >
            {hoveredBucket.rangeText} · {hoveredBucket.active}/
            {hoveredBucket.dayCount} active days ·{" "}
            {formatCount(hoveredBucket.total)} contributions
          </div>
        ) : null}
      </div>

      <div
        data-ribbon-months="true"
        className="relative h-4 w-full"
      >
        {ribbonTicks.map((item, idx) => {
          const isLast = idx === ribbonTicks.length - 1 && item.pct > 86;
          return (
            <span
              key={`${item.label}-${item.index}`}
              className="absolute top-0 font-mono text-[10px] leading-4 whitespace-nowrap text-muted-foreground select-none"
              style={isLast ? { right: 0 } : { left: `${item.pct}%` }}
            >
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Monthly bar + active-days marker/line chart visualizing monthly contribution volume & active days.
 */
export function MonthlyMomentumChart({
  days,
  today,
  onSelectMonth,
  loading = false,
  error = null,
  onRetry,
}: {
  days: DayCount[];
  today?: string;
  onSelectMonth?: (firstDayIso: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const hatchId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const rawMonths = monthRollup(days, today);
  const months = rawMonths.map((m) => {
    const firstInRange = days.find((d) => d.date.startsWith(m.key))?.date;
    return {
      ...m,
      firstDay: firstInRange ?? `${m.key}-01`,
      activePct: m.days > 0 ? Math.round((m.active / m.days) * 100) : 0,
    };
  });

  const peakRaw = peakMonthRollup(rawMonths);
  const peakMonth = peakRaw
    ? months.find((m) => m.key === peakRaw.key) ?? null
    : null;
  const totalVolume = months.reduce((sum, m) => sum + m.total, 0);

  const viewW = 560;
  const viewH = 180;
  const padLeft = 42;
  const padRight = 38;
  const padTop = 20;
  const padBottom = 26;
  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;
  const maxVolume = Math.max(1, ...months.map((m) => m.total));
  const { max: yMax, ticks } = niceAxisTicks(maxVolume);
  const activeAxisTicks = [0, 50, 100] as const;
  const slotW = months.length > 0 ? plotW / months.length : plotW;
  const barW = Math.min(26, Math.max(10, slotW * 0.6));
  const hoveredMonth = hoveredIdx !== null ? months[hoveredIdx] : null;

  const monthCoords = months.map((m, idx) => {
    const cx = padLeft + idx * slotW + slotW / 2;
    const ratio = m.days > 0 ? Math.min(1, m.active / m.days) : 0;
    const y = padTop + plotH - ratio * plotH;
    return { key: m.key, isPartial: m.isPartial, cx, y, ratio };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg">Monthly momentum</h2>
          <div
            data-monthly-legend="true"
            className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-[2px] bg-heat-3"
                aria-hidden="true"
              />
              <span>Volume</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-[2px] w-3.5 rounded-full bg-accent"
                aria-hidden="true"
              />
              <span>Active days %</span>
            </span>
          </div>
        </div>
        {!loading && !error && peakRaw && peakRaw.total > 0 ? (
          <span
            data-monthly-peak-pill="true"
            className="font-mono text-xs text-muted-foreground tabular-nums"
          >
            {formatPeakMonthLabel(peakRaw)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="h-44 w-full" data-chart-ready="false">
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div
          className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl bg-secondary/35 px-4 text-center"
          data-chart-ready="true"
          data-chart-error="true"
        >
          <p className="text-xs text-muted-foreground">{error}</p>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : months.length === 0 || totalVolume === 0 ? (
        <div
          className="flex h-44 w-full items-center justify-center rounded-xl bg-secondary/25 px-4 text-center text-xs text-muted-foreground"
          data-chart-ready="true"
        >
          No contributions in this period
        </div>
      ) : (
        <div
          className="relative h-44 w-full"
          data-chart-ready="true"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="size-full overflow-visible select-none"
            role="group"
            aria-label="Monthly momentum contribution bar and active days percentage chart"
          >
            <defs>
              <pattern
                id={hatchId}
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width="6"
                  height="6"
                  fill="color-mix(in oklab, var(--color-heat-2) 55%, transparent)"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--color-heat-4)"
                  strokeWidth="2"
                  strokeOpacity="0.7"
                />
              </pattern>
            </defs>

            {ticks.map((t, i) => {
              const y = padTop + plotH - (t / yMax) * plotH;
              return (
                <g key={`tick-${i}`} data-yaxis-left-tick={t}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={viewW - padRight}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeDasharray={t === 0 ? undefined : "3 3"}
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--color-muted-foreground)"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                  >
                    {compactCount(t)}
                  </text>
                </g>
              );
            })}

            {activeAxisTicks.map((t) => {
              const y = padTop + plotH - (t / 100) * plotH;
              return (
                <text
                  key={`active-tick-${t}`}
                  data-yaxis-right-tick={`${t}%`}
                  x={viewW - padRight + 8}
                  y={y + 4}
                  textAnchor="start"
                  fill="var(--color-accent)"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {t}%
                </text>
              );
            })}

            {months.map((m, idx) => {
              const isPeak = peakMonth?.key === m.key && m.total > 0;
              const isHovered = hoveredIdx === idx;
              const isFocused = focusedIdx === idx;
              const rawH = (m.total / yMax) * plotH;
              const barH = m.total > 0 ? Math.max(4, rawH) : 2;
              const cx = padLeft + idx * slotW + slotW / 2;
              const x = cx - barW / 2;
              const y = padTop + plotH - barH;

              return (
                <g
                  key={m.key}
                  data-month-bar={m.key}
                  data-partial={m.isPartial ? "true" : "false"}
                  role={onSelectMonth ? "button" : "listitem"}
                  tabIndex={0}
                  aria-label={`${m.label}${m.isPartial ? " (partial)" : ""}: ${formatCount(m.total)} contributions, ${m.active} of ${m.days} days (${m.activePct}%)`}
                  onClick={() => onSelectMonth?.(m.firstDay)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && onSelectMonth) {
                      e.preventDefault();
                      onSelectMonth(m.firstDay);
                    }
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => {
                    setFocusedIdx(idx);
                    setHoveredIdx(idx);
                  }}
                  onBlur={() => {
                    setFocusedIdx((prev) => (prev === idx ? null : prev));
                    setHoveredIdx(null);
                  }}
                  className={
                    onSelectMonth
                      ? "cursor-pointer focus:outline-none"
                      : "focus:outline-none"
                  }
                >
                  <rect
                    x={padLeft + idx * slotW}
                    y={padTop}
                    width={slotW}
                    height={plotH}
                    fill={
                      isFocused
                        ? "color-mix(in oklab, var(--color-accent) 12%, transparent)"
                        : isHovered
                          ? "color-mix(in oklab, var(--color-foreground) 5%, transparent)"
                          : "transparent"
                    }
                    rx="4"
                  />
                  {isFocused ? (
                    <rect
                      data-focus-ring="true"
                      x={padLeft + idx * slotW + 2}
                      y={padTop - 2}
                      width={Math.max(4, slotW - 4)}
                      height={plotH + 22}
                      rx="5"
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="2"
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="3"
                    fill={
                      m.isPartial
                        ? `url(#${hatchId})`
                        : isPeak || isFocused
                          ? "var(--color-heat-4)"
                          : m.total > 0
                            ? "var(--color-heat-3)"
                            : "var(--color-heat-0)"
                    }
                    stroke={
                      isFocused
                        ? "#ffffff"
                        : m.isPartial
                          ? "var(--color-heat-4)"
                          : isPeak || isHovered
                            ? "var(--color-accent)"
                            : "none"
                    }
                    strokeDasharray={m.isPartial && !isFocused ? "3 2" : undefined}
                    strokeWidth={
                      isFocused
                        ? "2"
                        : m.isPartial || isPeak || isHovered
                          ? "1"
                          : "0"
                    }
                  />
                  {m.isPartial ? (
                    <text
                      x={cx}
                      y={Math.max(11, y - 5)}
                      textAnchor="middle"
                      fill="var(--color-accent)"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                    >
                      partial
                    </text>
                  ) : null}
                  <text
                    x={cx}
                    y={viewH - 6}
                    textAnchor="middle"
                    fill={
                      isPeak || m.isPartial
                        ? "var(--color-foreground)"
                        : "var(--color-muted-foreground)"
                    }
                    fontWeight={isPeak ? "600" : "400"}
                    fontSize="10"
                    fontFamily="var(--font-sans)"
                  >
                    {m.shortLabel}
                  </text>
                </g>
              );
            })}

            {monthCoords.map((curr, idx) => {
              if (idx === 0) return null;
              const prev = monthCoords[idx - 1]!;
              const touchesPartial = prev.isPartial || curr.isPartial;
              return (
                <line
                  key={`seg-${prev.key}-${curr.key}`}
                  data-line-segment={`${prev.key}-${curr.key}`}
                  data-dashed={touchesPartial ? "true" : "false"}
                  x1={prev.cx}
                  y1={prev.y}
                  x2={curr.cx}
                  y2={curr.y}
                  stroke="var(--color-accent)"
                  strokeWidth="1.75"
                  strokeOpacity="0.9"
                  strokeDasharray={touchesPartial ? "4 3" : undefined}
                  pointerEvents="none"
                />
              );
            })}

            {monthCoords.map((pt, idx) => (
              <circle
                key={`dot-${pt.key}`}
                cx={pt.cx}
                cy={pt.y}
                r={hoveredIdx === idx ? "3.5" : "2.5"}
                fill="var(--color-accent)"
                stroke="var(--color-card)"
                strokeWidth="1.2"
                pointerEvents="none"
              />
            ))}
          </svg>

          {hoveredMonth ? (
            <div
              data-monthly-tooltip="true"
              className="pointer-events-none absolute top-1 right-10 z-20 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-lg"
            >
              <p className="font-semibold">
                {hoveredMonth.label}
                {hoveredMonth.isPartial ? " (partial)" : ""}
              </p>
              <p className="mt-0.5 font-mono tabular-nums">
                {formatCount(hoveredMonth.total)} contributions
              </p>
              <p className="font-mono text-[11px] opacity-85 tabular-nums">
                {hoveredMonth.active} of {hoveredMonth.days} days (
                {hoveredMonth.activePct}%)
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export type SparkBarItem = {
  value: number;
  label: string;
  highlighted?: boolean;
};

/**
 * Compact inline sparkline bars for StatCards with per-bar hover/focus tooltips.
 */
export function MiniSparkBars({
  values,
  highlightIndex,
  items,
}: {
  values?: number[];
  highlightIndex?: number;
  items?: SparkBarItem[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const resolved: SparkBarItem[] =
    items ??
    (values ?? []).map((v, idx, arr) => ({
      value: v,
      label: `${v.toLocaleString("en-IN")} contributions`,
      highlighted:
        highlightIndex !== undefined
          ? idx === highlightIndex
          : idx === arr.length - 1,
    }));

  if (resolved.length === 0) return null;
  const max = Math.max(1, ...resolved.map((item) => item.value));
  const hovered = hoveredIdx !== null ? resolved[hoveredIdx] : null;

  return (
    <div
      className="relative flex h-7 items-end gap-[3px]"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {resolved.map((item, idx) => {
        const heightPct =
          item.value === 0
            ? 16
            : Math.max(26, Math.round((item.value / max) * 100));
        return (
          <button
            key={idx}
            type="button"
            data-spark-bar={idx}
            title={item.label}
            aria-label={item.label}
            onMouseEnter={() => setHoveredIdx(idx)}
            onFocus={() => setHoveredIdx(idx)}
            onBlur={() => setHoveredIdx(null)}
            className="group flex h-full items-end rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span
              style={{ height: `${heightPct}%` }}
              className={cn(
                "w-1.5 rounded-t-[2px] transition-all group-hover:scale-y-110",
                item.value === 0
                  ? "bg-heat-0"
                  : item.highlighted
                    ? "bg-heat-4"
                    : "bg-heat-2 group-hover:bg-heat-3",
              )}
            />
          </button>
        );
      })}
      {hovered ? (
        <div
          data-spark-tooltip="true"
          className="pointer-events-none absolute -top-7 right-0 z-30 rounded-md bg-foreground px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-background shadow-md tabular-nums"
        >
          {hovered.label}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 14-day mini heatmap strip built from BoardEntry.byDate or DayCount[].
 */
export function MiniHeatStrip({
  byDate,
  today,
  days = 14,
}: {
  byDate: Record<string, number>;
  today: string;
  days?: number;
}) {
  const end = parseISO(today);
  const cells: { iso: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const iso = format(subDays(end, i), "yyyy-MM-dd");
    cells.push({ iso, count: byDate[iso] ?? 0 });
  }
  const peak = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label={`Last ${days} days activity`}
    >
      {cells.map((c) => {
        const ratio = c.count / peak;
        const level: 0 | 1 | 2 | 3 | 4 =
          c.count <= 0
            ? 0
            : ratio < 0.25
              ? 1
              : ratio < 0.5
                ? 2
                : ratio < 0.8
                  ? 3
                  : 4;
        return (
          <span
            key={c.iso}
            title={`${c.iso}: ${c.count} contributions`}
            style={{ backgroundColor: HEAT_COLORS[level] }}
            className="size-2.5 rounded-[2px]"
          />
        );
      })}
    </div>
  );
}

/**
 * Multi-segment SVG Donut + stacked bar for repository primary languages.
 */
export function LanguageDonut({
  languages,
}: {
  languages: LanguageMixItem[];
}) {
  const top = languages.slice(0, 7);
  const total = Math.max(
    1,
    top.reduce((sum, item) => sum + item.repos, 0),
  );
  const size = 132;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-heat-0)"
            strokeWidth={stroke}
          />
          {top.map((row, idx) => {
            const share = row.repos / total;
            const dash = share * circumference;
            const offset = circumference * (1 - accumulated);
            accumulated += share;
            return (
              <circle
                key={row.language}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={languageColor(row.language, idx)}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(2, dash - 2)} ${circumference}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl leading-none font-semibold tabular-nums">
            {top.length}
          </span>
          <span className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            Languages
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {top.map((row, idx) => {
          const pct = Math.round((row.repos / total) * 100);
          const color = languageColor(row.language, idx);
          return (
            <div key={row.language} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {row.language}
                </span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {row.repos} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-heat-0">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dual-series monthly and weekday visual comparison charts for CompareView.
 */
export function HeadToHeadCharts({
  leftLogin,
  rightLogin,
  leftDays,
  rightDays,
  leftWeekday,
  rightWeekday,
}: {
  leftLogin: string;
  rightLogin: string;
  leftDays: DayCount[];
  rightDays: DayCount[];
  leftWeekday: WeekdayRow[];
  rightWeekday: WeekdayRow[];
}) {
  const leftMonths = monthRollup(leftDays);
  const rightMonthsByKey = new Map(
    monthRollup(rightDays).map((m) => [m.key, m]),
  );

  const monthlySeries = leftMonths.map((m) => ({
    key: m.key,
    label: m.label.split(" ")[0] ?? m.label,
    fullLabel: m.label,
    left: m.total,
    right: rightMonthsByKey.get(m.key)?.total ?? 0,
  }));

  const weekdaySeries = leftWeekday.map((row, idx) => ({
    label: row.label,
    left: row.count,
    right: rightWeekday[idx]?.count ?? 0,
  }));

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg">Monthly trajectory</h2>
            <p className="text-xs text-muted-foreground">
              Side-by-side volume across months
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-heat-4" />
              {leftLogin}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: "#38bdf8" }}
              />
              {rightLogin}
            </span>
          </div>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySeries} barGap={2} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{
                  fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)",
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as (typeof monthlySeries)[number];
                  return (
                    <div className="rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg">
                      <p className="font-semibold">{row.fullLabel}</p>
                      <p className="mt-1 font-mono text-[#39d353]">
                        {leftLogin}: {formatCount(row.left)}
                      </p>
                      <p className="font-mono text-[#38bdf8]">
                        {rightLogin}: {formatCount(row.right)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="left"
                fill="var(--color-heat-4)"
                radius={[3, 3, 0, 0]}
              />
              <Bar dataKey="right" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg">Weekday head-to-head</h2>
            <p className="text-xs text-muted-foreground">
              Day-of-week shipping pattern
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-heat-4" />
              {leftLogin}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: "#38bdf8" }}
              />
              {rightLogin}
            </span>
          </div>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdaySeries} barGap={3} barCategoryGap="22%">
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{
                  fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)",
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as (typeof weekdaySeries)[number];
                  return (
                    <div className="rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg">
                      <p className="font-semibold">{row.label}</p>
                      <p className="mt-1 font-mono text-[#39d353]">
                        {leftLogin}: {formatCount(row.left)}
                      </p>
                      <p className="font-mono text-[#38bdf8]">
                        {rightLogin}: {formatCount(row.right)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="left"
                fill="var(--color-heat-4)"
                radius={[3, 3, 0, 0]}
              />
              <Bar dataKey="right" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
