import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { format, parseISO } from "date-fns";
import { Box, Grid } from "lucide-react";
import { heatmapGrid, shiftDate } from "@/lib/github/layout";
import {
  INTENSITY_THRESHOLDS,
  intensityLevelForCount,
} from "@/lib/github/stats";
import type { DayCount } from "@/lib/github/types";
import { cn } from "@/lib/utils";
import { Skyline3D } from "./skyline-3d";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const VIEW_STORAGE_KEY = "cadence:view";

export type HeatmapViewMode = "2d" | "3d";

type HeatmapProps = {
  days: DayCount[];
  selectedDate?: string;
  onSelect?: (date: string) => void;
  compact?: boolean;
  theme?: "emerald" | "sky";
  defaultMode?: HeatmapViewMode;
  view?: HeatmapViewMode;
  onViewChange?: (view: HeatmapViewMode) => void;
};

function levelClass(level: number) {
  if (level >= 5) return "bg-heat-5";
  if (level === 4) return "bg-heat-4";
  if (level === 3) return "bg-heat-3";
  if (level === 2) return "bg-heat-2";
  if (level === 1) return "bg-heat-1";
  return "bg-heat-0 border border-[#6b7280]";
}

function formatDayTip(day: DayCount): string {
  const noun = day.count === 1 ? "contribution" : "contributions";
  return `${day.count.toLocaleString("en-IN")} ${noun} · ${format(parseISO(day.date), "EEE, d MMM yyyy")}`;
}

function formatCellAriaLabel(day: DayCount): string {
  const noun = day.count === 1 ? "contribution" : "contributions";
  return `${format(parseISO(day.date), "EEE d MMM yyyy")}: ${day.count.toLocaleString("en-IN")} ${noun}`;
}

export function Heatmap({
  days,
  selectedDate,
  onSelect,
  compact = false,
  theme = "emerald",
  defaultMode = "2d",
  view,
  onViewChange,
}: HeatmapProps) {
  const [internalMode, setInternalMode] = useState<HeatmapViewMode>(
    view ?? defaultMode,
  );
  const [tip, setTip] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const { weeks, monthLabels } = useMemo(() => heatmapGrid(days), [days]);
  const interactive = Boolean(onSelect);
  const mode: HeatmapViewMode = view ?? internalMode;

  useEffect(() => {
    if (view) {
      setInternalMode(view);
      return;
    }
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "3d" || saved === "2d") {
        setInternalMode(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [view]);

  function changeMode(next: HeatmapViewMode) {
    setInternalMode(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    onViewChange?.(next);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [days, mode]);

  const yearSummaryText = useMemo(() => {
    if (days.length === 0) return "No contribution data available for this period.";
    const total = days.reduce((sum, d) => sum + d.count, 0);
    const active = days.filter((d) => d.count > 0).length;
    const pct = Math.round((active / days.length) * 100);
    const from = days[0]?.date ?? "";
    const to = days[days.length - 1]?.date ?? "";
    return `Year contribution summary from ${from} to ${to}: ${total.toLocaleString("en-IN")} total contributions across ${active} active days out of ${days.length} calendar days (${pct}% active).`;
  }, [days]);

  function handleCellKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, iso: string) {
    if (!onSelect || days.length === 0) return;
    let nextIso: string | null = null;
    if (e.key === "ArrowLeft") nextIso = shiftDate(days, iso, -7);
    else if (e.key === "ArrowRight") nextIso = shiftDate(days, iso, 7);
    else if (e.key === "ArrowUp") nextIso = shiftDate(days, iso, -1);
    else if (e.key === "ArrowDown") nextIso = shiftDate(days, iso, 1);
    else if (e.key === "Home") nextIso = days[0]?.date ?? null;
    else if (e.key === "End") nextIso = days[days.length - 1]?.date ?? null;
    if (!nextIso) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(nextIso);
    window.requestAnimationFrame(() => {
      const btn = gridRef.current?.querySelector<HTMLButtonElement>(
        `button[data-heatmap-day="${nextIso}"]`,
      );
      btn?.focus();
    });
  }

  const numWeeks = Math.max(1, weeks.length);
  const focusedDay = focusedDate
    ? days.find((d) => d.date === focusedDate) ?? null
    : null;
  const activeTabDate =
    focusedDate ??
    (selectedDate && days.some((d) => d.date === selectedDate)
      ? selectedDate
      : days[days.length - 1]?.date ?? null);

  return (
    <div className="relative space-y-3 sm:space-y-3.5">
      <p className="sr-only">{yearSummaryText}</p>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div
          role="group"
          aria-label="Map view mode"
          className="inline-flex items-center rounded-xl bg-secondary/70 p-1 shadow-[var(--shadow-border)]"
        >
          {(
            [
              { id: "2d", label: "Grid", icon: Grid },
              { id: "3d", label: "3D", icon: Box },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => changeMode(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs transition-colors",
                  active
                    ? "bg-card text-accent shadow-[var(--shadow-border)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div
          data-heatmap-legend="true"
          className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground tabular-nums sm:gap-2.5"
        >
          {INTENSITY_THRESHOLDS.map((item) => (
            <span
              key={item.level}
              className="inline-flex items-center gap-1"
              title={`${item.label}: ${item.rangeLabel} contributions`}
            >
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-[2.5px] sm:size-3",
                  levelClass(item.level),
                )}
              />
              <span>{item.rangeLabel}</span>
            </span>
          ))}
        </div>
      </div>

      {mode === "3d" ? (
        <Skyline3D
          days={days}
          selectedDate={selectedDate}
          onSelect={onSelect}
          compact={compact}
          theme={theme}
        />
      ) : (
        <div
          ref={gridRef}
          role="grid"
          aria-label="Contribution calendar grid"
          className="relative"
        >
          <div ref={scrollRef} className="max-w-full overflow-x-auto pb-2">
            <div className="flex w-full min-w-[680px] flex-col gap-1.5">
              <div className="relative ml-8 h-4">
                {(() => {
                  let prevPct = -100;
                  return monthLabels.map((item) => {
                    const rawPct = (item.index / numWeeks) * 100;
                    const minGap = item.label.includes("'") ? 6.5 : 5.5;
                    const leftPct = Math.max(rawPct, prevPct + minGap);
                    prevPct = leftPct;
                    const isRightEdge = leftPct > 93;
                    return (
                      <span
                        key={`${item.label}-${item.index}`}
                        className="absolute top-0 text-[11px] leading-4 font-medium whitespace-nowrap text-muted-foreground select-none"
                        style={
                          isRightEdge
                            ? { right: 0 }
                            : { left: `${leftPct}%` }
                        }
                      >
                        {item.label}
                      </span>
                    );
                  });
                })()}
              </div>

              <div className="flex w-full items-stretch gap-2">
                <div className="grid w-6 shrink-0 grid-rows-7 gap-[3px] py-[1px]">
                  {WEEKDAYS.map((label, i) => (
                    <span
                      key={label}
                      className={cn(
                        "flex items-center font-mono text-[10px] leading-none text-muted-foreground select-none",
                        i % 2 === 0 ? "invisible" : "visible",
                      )}
                    >
                      {label.slice(0, 3)}
                    </span>
                  ))}
                </div>

                <div
                  className="grid flex-1 gap-[3px]"
                  style={{
                    gridTemplateColumns: `repeat(${numWeeks}, minmax(10px, 1fr))`,
                  }}
                >
                  {weeks.map((week, wi) => (
                    <div
                      key={wi}
                      role="row"
                      className="grid grid-rows-7 gap-[3px]"
                    >
                      {week.map((day, di) => {
                        if (!day) {
                          return (
                            <span
                              key={di}
                              className="aspect-square w-full rounded-[3px]"
                            />
                          );
                        }
                        const lvl = intensityLevelForCount(day.count);
                        const selected = day.date === selectedDate;
                        const focused = day.date === focusedDate;
                        const ariaLabel = formatCellAriaLabel(day);
                        const className = cn(
                          "aspect-square w-full rounded-[3px] outline-none",
                          levelClass(lvl),
                          selected &&
                            !focused &&
                            "z-10 ring-2 ring-white ring-offset-1 ring-offset-card",
                          focused &&
                            "z-20 scale-125 ring-2 ring-accent ring-offset-2 ring-offset-card shadow-[0_0_0_4px_rgba(57,211,83,0.28)]",
                          interactive
                            ? "transition-[box-shadow,transform] duration-150 ease-out hover:scale-115 focus-visible:z-20 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                            : "transition-opacity duration-150 hover:opacity-85",
                        );
                        if (!interactive) {
                          return (
                            <span
                              key={day.date}
                              data-heatmap-day={day.date}
                              data-selected={selected ? "true" : "false"}
                              role="gridcell"
                              aria-label={ariaLabel}
                              title={ariaLabel}
                              onMouseEnter={() => setTip(formatDayTip(day))}
                              onMouseLeave={() => setTip(null)}
                              className={className}
                            />
                          );
                        }
                        return (
                          <button
                            key={day.date}
                            type="button"
                            role="gridcell"
                            tabIndex={day.date === activeTabDate ? 0 : -1}
                            data-heatmap-day={day.date}
                            data-selected={selected ? "true" : "false"}
                            data-focused={focused ? "true" : "false"}
                            aria-label={ariaLabel}
                            aria-pressed={selected}
                            onMouseEnter={() => setTip(formatDayTip(day))}
                            onMouseLeave={() => setTip(null)}
                            onFocus={() => {
                              setFocusedDate(day.date);
                              setTip(formatDayTip(day));
                            }}
                            onBlur={() => {
                              setFocusedDate((prev) =>
                                prev === day.date ? null : prev,
                              );
                              setTip(null);
                            }}
                            onClick={() => onSelect?.(day.date)}
                            onKeyDown={(e) => handleCellKeyDown(e, day.date)}
                            className={className}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            {focusedDay ? (
              <div
                data-heatmap-focus-tip="true"
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-0.5 font-mono text-xs text-background shadow-sm tabular-nums"
              >
                <span className="size-2 shrink-0 rounded-full bg-accent" />
                <span>{formatDayTip(focusedDay)} · Focused</span>
              </div>
            ) : (
              <span className="min-h-4 font-mono tabular-nums">
                {tip ??
                  (interactive
                    ? "Click any day or use ← → ↑ ↓ keys to inspect"
                    : "Hover a square to inspect day total")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
