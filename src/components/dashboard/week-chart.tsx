import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { RotateCcw } from "lucide-react";
import { compactCount, niceAxisTicks } from "@/lib/github/layout";
import type { DayCount } from "@/lib/github/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type WeekChartProps = {
  days: DayCount[];
  selectedDate: string;
  onSelect?: (date: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function WeekChart({
  days,
  selectedDate,
  onSelect,
  loading = false,
  error = null,
  onRetry,
}: WeekChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1040);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setContainerWidth(w);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  if (loading) {
    return (
      <div ref={containerRef} className="h-44 w-full" data-chart-ready="false">
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={containerRef}
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
    );
  }

  const data = days
    .filter((d) => d.date <= selectedDate)
    .slice(-14)
    .map((d) => ({
      date: d.date,
      label: format(parseISO(d.date), "d MMM"),
      shortLabel: format(parseISO(d.date), "d"),
      weekday: format(parseISO(d.date), "EEE"),
      count: d.count,
      selected: d.date === selectedDate,
    }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-44 w-full items-center justify-center rounded-xl bg-secondary/25 px-4 text-center text-xs text-muted-foreground"
        data-chart-ready="true"
      >
        No contributions in this period
      </div>
    );
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const { max: yMax, ticks } = niceAxisTicks(maxCount);
  const viewW = Math.max(280, containerWidth);
  const viewH = 176;
  const padLeft = 32;
  const padRight = 0;
  const padTop = 14;
  const padBottom = 26;
  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;
  const slotW = plotW / data.length;
  const barW = Math.min(48, Math.max(10, slotW * 0.68));
  const activeIdx = focusedIdx ?? hoveredIdx;
  const activeRow = activeIdx !== null ? data[activeIdx] : null;

  return (
    <div
      ref={containerRef}
      className="relative h-44 w-full"
      data-chart-ready="true"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="block size-full overflow-visible select-none"
        role="group"
        aria-label={`Last 14 days ending ${selectedDate}`}
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
                x={0}
                y={y + 4}
                textAnchor="start"
                fill="var(--color-muted-foreground)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {compactCount(t)}
              </text>
            </g>
          );
        })}

        {data.map((row, idx) => {
          const isHovered = hoveredIdx === idx;
          const isFocused = focusedIdx === idx;
          const rawH = (row.count / yMax) * plotH;
          const barH = row.count > 0 ? Math.max(5, rawH) : 3;
          const cx = padLeft + idx * slotW + slotW / 2;
          const x = cx - barW / 2;
          const y = padTop + plotH - barH;

          return (
            <g
              key={row.date}
              data-day-bar={row.date}
              data-selected={row.selected ? "true" : "false"}
              data-focused={isFocused ? "true" : "false"}
              role={onSelect ? "button" : "listitem"}
              tabIndex={0}
              aria-label={`${row.weekday} ${row.label}: ${row.count.toLocaleString("en-IN")} contributions${row.selected ? " (selected)" : ""}`}
              onClick={() => onSelect?.(row.date)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && onSelect) {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(row.date);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  e.stopPropagation();
                  const nextIdx =
                    e.key === "ArrowLeft"
                      ? Math.max(0, idx - 1)
                      : Math.min(data.length - 1, idx + 1);
                  const nextDate = data[nextIdx]?.date;
                  if (nextDate) {
                    const nextEl = containerRef.current?.querySelector<SVGGElement>(
                      `g[data-day-bar="${nextDate}"]`,
                    );
                    nextEl?.focus();
                  }
                }
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setFocusedIdx(idx)}
              onBlur={() =>
                setFocusedIdx((prev) => (prev === idx ? null : prev))
              }
              className={onSelect ? "cursor-pointer focus:outline-none" : "focus:outline-none"}
            >
              <rect
                x={padLeft + idx * slotW}
                y={padTop}
                width={slotW}
                height={plotH}
                fill={
                  isFocused
                    ? "color-mix(in oklab, var(--color-accent) 12%, transparent)"
                    : isHovered || row.selected
                      ? "color-mix(in oklab, var(--color-foreground) 6%, transparent)"
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
                  row.selected || isFocused
                    ? "var(--color-heat-4)"
                    : row.count > 0
                      ? "var(--color-heat-3)"
                      : "var(--color-heat-1)"
                }
                stroke={
                  isFocused
                    ? "#ffffff"
                    : row.selected
                      ? "var(--color-foreground)"
                      : isHovered
                        ? "var(--color-accent)"
                        : "none"
                }
                strokeWidth={
                  isFocused ? "2" : row.selected ? "1.5" : isHovered ? "1" : "0"
                }
              />
              {row.selected ? (
                <circle
                  cx={cx}
                  cy={Math.max(6, y - 6)}
                  r="3"
                  fill="var(--color-heat-4)"
                />
              ) : null}
              <text
                x={cx}
                y={viewH - 8}
                textAnchor="middle"
                fill={
                  row.selected || isFocused
                    ? "var(--color-foreground)"
                    : "var(--color-muted-foreground)"
                }
                fontWeight={row.selected || isFocused ? "600" : "400"}
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {row.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {activeRow ? (
        <div
          data-week-chart-tip="true"
          className="pointer-events-none absolute top-1 right-2 rounded-lg bg-foreground px-2.5 py-1.5 font-mono text-xs text-background shadow-md tabular-nums"
        >
          {activeRow.count.toLocaleString("en-IN")} · {activeRow.weekday},{" "}
          {activeRow.label}
          {activeRow.selected
            ? " · Selected"
            : onSelect
              ? " (click to select)"
              : ""}
        </div>
      ) : null}
    </div>
  );
}
