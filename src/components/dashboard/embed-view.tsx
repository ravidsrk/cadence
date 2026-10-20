import { useState } from "react";
import { Box, Grid3X3 } from "lucide-react";
import { boardEntryFromCalendar, classifyTier } from "@/lib/github/board";
import { SITE_ORIGIN } from "@/lib/site";
import type { CalendarPayload } from "@/lib/github/types";
import { profilePath } from "@/lib/github/username";
import { cn } from "@/lib/utils";
import { Heatmap } from "./heatmap";
import { Skyline3D } from "./skyline-3d";

export function EmbedView({
  calendar,
  year,
  initialView = "3d",
}: {
  calendar: CalendarPayload;
  year?: number;
  initialView?: "3d" | "2d";
}) {
  const [view, setView] = useState<"3d" | "2d">(initialView);
  const login = calendar.profile.login;
  const entry = boardEntryFromCalendar(login, calendar);
  const tier = classifyTier(entry.score.total);
  const basePath = `${SITE_ORIGIN}${profilePath(login)}`;
  const href = year ? `${basePath}?range=${year}` : basePath;
  return (
    <div className="bg-background px-3 py-3 text-foreground">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-medium hover:underline"
          >
            {calendar.profile.name || login}
            <span className="ml-1.5 font-mono text-muted-foreground">
              @{login}
            </span>
          </a>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] ${tier.tone}`}
          >
            {tier.label} · {entry.score.total}/100
          </span>
          <span className="hidden items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground/85 sm:inline-flex">
            {entry.archetype.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {calendar.stats.total.toLocaleString("en-IN")} ·{" "}
            {calendar.stats.currentStreak}d
          </span>
          <div className="inline-flex items-center rounded-lg bg-secondary/70 p-0.5 text-[10px] font-medium shadow-[var(--shadow-border)]">
            <button
              type="button"
              onClick={() => setView("3d")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
                view === "3d"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Box className="size-2.5 text-accent" />
              3D
            </button>
            <button
              type="button"
              onClick={() => setView("2d")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
                view === "2d"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Grid3X3 className="size-2.5 text-accent" />
              2D
            </button>
          </div>
        </div>
      </div>
      {view === "3d" ? (
        <Skyline3D days={calendar.days} />
      ) : (
        <Heatmap days={calendar.days} compact view={view} onViewChange={setView} />
      )}
      <p className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            Cadence
          </a>
          {year ? ` · ${year}` : " · last 12 months"} · {tier.shortLabel} Tier
        </span>
        <span className="font-mono text-[10px] text-accent">
          {calendar.stats.activeDays}d active (
          {Math.round(entry.consistency * 100)}%)
        </span>
      </p>
    </div>
  );
}
