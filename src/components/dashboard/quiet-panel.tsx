import { format, parseISO } from "date-fns";
import type { QuietStats } from "@/lib/github/gaps";

export function QuietPanel({ quiet }: { quiet: QuietStats }) {
  return (
    <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt className="text-xs tracking-wide text-muted-foreground uppercase">
          Longest pause
        </dt>
        <dd className="mt-1 font-mono tabular-nums">
          {quiet.longestGap ? `${quiet.longestGap.days}d` : "—"}
        </dd>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {quiet.longestGap
            ? `${format(parseISO(quiet.longestGap.start), "d MMM")}–${format(parseISO(quiet.longestGap.end), "d MMM")}`
            : "No empty run"}
        </p>
      </div>
      <div>
        <dt className="text-xs tracking-wide text-muted-foreground uppercase">
          Current pause
        </dt>
        <dd className="mt-1 font-mono tabular-nums">
          {quiet.currentPause === 0 ? "0" : `${quiet.currentPause}d`}
        </dd>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {quiet.currentPause === 0 ? "Shipping today" : "Days since last square"}
        </p>
      </div>
      <div>
        <dt className="text-xs tracking-wide text-muted-foreground uppercase">
          Quietest month
        </dt>
        <dd className="mt-1 font-mono tabular-nums">
          {quiet.quietestMonth?.label.replace(/ \d{4}$/, "") ?? "—"}
        </dd>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {quiet.quietestMonth
            ? `${quiet.quietestMonth.active} active days`
            : "Not enough range"}
        </p>
      </div>
    </dl>
  );
}
