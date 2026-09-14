import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekdayRow } from "@/lib/github/insights";

export function WeekdayChart({ rows }: { rows: WeekdayRow[] }) {
  const peak = Math.max(0, ...rows.map((row) => row.count));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap="18%">
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
            cursor={{
              fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as WeekdayRow;
              return (
                <div className="rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background">
                  {row.count} · {row.label}
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={
                  peak > 0 && row.count === peak
                    ? "var(--color-heat-4)"
                    : "var(--color-heat-3)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
