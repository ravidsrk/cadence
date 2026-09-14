import { SITE_ORIGIN } from "@/lib/site";
import type { CalendarPayload } from "@/lib/github/types";
import { Heatmap } from "./heatmap";

export function EmbedView({
  calendar,
  year,
}: {
  calendar: CalendarPayload;
  year?: number;
}) {
  const login = calendar.profile.login;
  const href = year
    ? `${SITE_ORIGIN}/u/${login}?y=${year}`
    : `${SITE_ORIGIN}/u/${login}`;
  return (
    <div className="bg-background px-3 py-3 text-foreground">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm font-medium hover:underline"
        >
          {calendar.profile.name || login}
          <span className="ml-2 font-mono text-muted-foreground">@{login}</span>
        </a>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {calendar.stats.total.toLocaleString("en-IN")} ·{" "}
          {calendar.stats.currentStreak}d
        </span>
      </div>
      <Heatmap days={calendar.days} />
      <p className="mt-2 text-[11px] text-muted-foreground">
        <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
          Cadence
        </a>
        {year ? ` · ${year}` : " · last 12 months"}
      </p>
    </div>
  );
}
