import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { heatmapGrid } from "@/lib/github/layout";
import { cn } from "@/lib/utils";
import type { DayCount } from "@/lib/github/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;

type HeatmapProps = {
  days: DayCount[];
  selectedDate?: string;
  onSelect?: (date: string) => void;
};

function levelClass(level: number) {
  if (level >= 4) return "bg-heat-4";
  if (level === 3) return "bg-heat-3";
  if (level === 2) return "bg-heat-2";
  if (level === 1) return "bg-heat-1";
  return "bg-heat-0";
}

export function Heatmap({ days, selectedDate, onSelect }: HeatmapProps) {
  const [tip, setTip] = useState<string | null>(null);
  const { weeks, monthLabels } = useMemo(() => heatmapGrid(days), [days]);
  const interactive = Boolean(onSelect);

  return (
    <div className="relative">
      <div className="max-w-full overflow-x-auto pb-2">
        <div className="inline-flex min-w-full gap-3 px-1">
          <div className="flex flex-col justify-end gap-[3px] pt-5">
            {WEEKDAYS.map((label, i) => (
              <span
                key={label}
                className={cn(
                  "h-3 text-[10px] leading-3 text-muted-foreground",
                  i % 2 === 0 ? "invisible" : "visible",
                )}
              >
                {label.slice(0, 3)}
              </span>
            ))}
          </div>
          <div className="flex flex-col">
            <div
              className="relative mb-1 h-4"
              style={{ width: Math.max(0, weeks.length * STEP - GAP) }}
            >
              {monthLabels.map((item) => (
                <span
                  key={`${item.label}-${item.index}`}
                  className="absolute top-0 text-[10px] leading-4 text-muted-foreground"
                  style={{ left: item.index * STEP }}
                >
                  {item.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    if (!day) {
                      return <span key={di} className="size-3 rounded-[2px]" />;
                    }
                    const selected = day.date === selectedDate;
                    const className = cn(
                      "size-3 rounded-[2px] outline-none",
                      levelClass(day.level),
                      selected &&
                        "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                      interactive &&
                        "transition-[box-shadow,transform] duration-150 ease-out hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring",
                    );
                    if (!interactive) {
                      return (
                        <span
                          key={day.date}
                          title={`${day.count} on ${day.date}`}
                          className={className}
                        />
                      );
                    }
                    return (
                      <button
                        key={day.date}
                        type="button"
                        aria-label={`${day.count} contributions on ${day.date}`}
                        aria-pressed={selected}
                        onMouseEnter={() =>
                          setTip(
                            `${day.count} on ${format(parseISO(day.date), "d MMM")}`,
                          )
                        }
                        onMouseLeave={() => setTip(null)}
                        onFocus={() =>
                          setTip(
                            `${day.count} on ${format(parseISO(day.date), "d MMM")}`,
                          )
                        }
                        onBlur={() => setTip(null)}
                        onClick={() => onSelect?.(day.date)}
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
      {interactive ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="min-h-4 tabular-nums">
            {tip ?? "Select a day · ← → to move"}
          </span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            <span className="size-3 rounded-[2px] bg-heat-0" />
            <span className="size-3 rounded-[2px] bg-heat-1" />
            <span className="size-3 rounded-[2px] bg-heat-2" />
            <span className="size-3 rounded-[2px] bg-heat-3" />
            <span className="size-3 rounded-[2px] bg-heat-4" />
            <span>More</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
