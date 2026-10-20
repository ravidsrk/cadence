import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { orderWeekdaysMonFirst, type WeekdayRow } from "@/lib/github/insights";
import { compactCount, niceAxisTicks } from "@/lib/github/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export function WeekdayChart({
  rows,
  loading = false,
  error = null,
  onRetry,
}: {
  rows: WeekdayRow[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="h-40 w-full" data-chart-ready="false">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl bg-secondary/35 px-4 text-center"
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
    );
  }

  const ordered = orderWeekdaysMonFirst(rows);
  const total = ordered.reduce((sum, r) => sum + r.count, 0);
  const peak = Math.max(0, ...ordered.map((row) => row.count));

  if (ordered.length === 0 || total === 0) {
    return (
      <div
        className="flex h-40 w-full items-center justify-center rounded-xl bg-secondary/25 px-4 text-center text-xs text-muted-foreground"
        data-chart-ready="true"
      >
        No contributions in this period
      </div>
    );
  }

  const viewW = 520;
  const viewH = 160;
  const padLeft = 42;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 26;
  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;
  const { max: yMax, ticks } = niceAxisTicks(peak);
  const slotW = plotW / ordered.length;
  const barW = Math.min(44, Math.max(18, slotW * 0.64));
  const hoveredRow = hoveredIdx !== null ? ordered[hoveredIdx] : null;

  return (
    <div
      className="relative h-40 w-full"
      data-chart-ready="true"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="size-full overflow-visible select-none"
        role="list"
        aria-label="Weekday rhythm contribution bar chart (Monday to Sunday)"
      >
        {ticks.map((t, i) => {
          const y = padTop + plotH - (t / yMax) * plotH;
          return (
            <g key={`tick-${i}`}>
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

        {ordered.map((row, idx) => {
          const isPeak = peak > 0 && row.count === peak;
          const isHovered = hoveredIdx === idx;
          const isFocused = focusedIdx === idx;
          const rawH = (row.count / yMax) * plotH;
          const barH = row.count > 0 ? Math.max(4, rawH) : 2;
          const cx = padLeft + idx * slotW + slotW / 2;
          const x = cx - barW / 2;
          const y = padTop + plotH - barH;

          return (
            <g
              key={row.label}
              tabIndex={0}
              role="listitem"
              aria-label={`${row.label}: ${formatCount(row.count)} contributions${isPeak ? " (peak)" : ""}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => {
                setFocusedIdx(idx);
                setHoveredIdx(idx);
              }}
              onBlur={() => {
                setFocusedIdx((prev) => (prev === idx ? null : prev));
                setHoveredIdx(null);
              }}
              className="cursor-pointer focus:outline-none"
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
                  rx="6"
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
                rx="4"
                fill={
                  isPeak || isFocused
                    ? "var(--color-heat-4)"
                    : row.count > 0
                      ? "var(--color-heat-3)"
                      : "var(--color-heat-0)"
                }
                stroke={
                  isFocused
                    ? "#ffffff"
                    : isPeak || isHovered
                      ? "var(--color-accent)"
                      : "none"
                }
                strokeWidth={isFocused ? "2" : isPeak || isHovered ? "1" : "0"}
              />
              <text
                x={cx}
                y={viewH - 6}
                textAnchor="middle"
                fill={
                  isPeak || isFocused
                    ? "var(--color-foreground)"
                    : "var(--color-muted-foreground)"
                }
                fontWeight={isPeak || isFocused ? "600" : "400"}
                fontSize="11"
                fontFamily="var(--font-sans)"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredRow ? (
        <div className="pointer-events-none absolute top-1 right-2 rounded-lg bg-foreground px-2.5 py-1 font-mono text-xs text-background shadow-md tabular-nums">
          {hoveredRow.label}: {formatCount(hoveredRow.count)}
          {peak > 0 && hoveredRow.count === peak ? " · Peak" : ""}
        </div>
      ) : null}
    </div>
  );
}
