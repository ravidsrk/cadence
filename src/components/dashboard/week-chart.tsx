import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayCount } from "@/lib/github/types";

type WeekChartProps = {
  days: DayCount[];
  selectedDate: string;
};

export function WeekChart({ days, selectedDate }: WeekChartProps) {
  const data = days
    .filter((d) => d.date <= selectedDate)
    .slice(-14)
    .map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "d"),
    month: format(parseISO(d.date), "MMM"),
    count: d.count,
    selected: d.date === selectedDate,
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
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
            width={32}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background">
                  {row.count} · {format(parseISO(row.date), "d MMM")}
                </div>
              );
            }}
          />
          <Bar
            dataKey="count"
            radius={[3, 3, 0, 0]}
            fill="var(--color-heat-3)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
