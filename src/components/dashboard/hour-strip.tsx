import { cn } from "@/lib/utils";

export function HourStrip({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const labels = [0, 6, 12, 18, 23];

  return (
    <div>
      <div className="flex h-14 items-end gap-px">
        {hours.map((count, hour) => (
          <div
            key={hour}
            title={`${String(hour).padStart(2, "0")}:00 · ${count}`}
            className={cn(
              "min-h-0.5 flex-1 rounded-sm",
              count > 0 ? "bg-heat-3" : "bg-heat-0",
            )}
            style={{ height: `${Math.max(count > 0 ? 12 : 8, (count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
        {labels.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}
