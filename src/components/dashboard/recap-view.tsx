import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  Flame,
  GitCommitHorizontal,
  GitPullRequest,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import {
  boardEntryFromCalendar,
  classifyTier,
} from "@/lib/github/board";
import {
  busiestWeekday,
  consistency,
  orderWeekdaysMonFirst,
  weekdayTotals,
} from "@/lib/github/insights";
import {
  monthRollup,
  peakMonthRollup,
  quietStats,
} from "@/lib/github/gaps";
import { longestStreakWindow } from "@/lib/github/stats";
import { isGithubFnError } from "@/lib/github/types";
import type { RecapLoaderData } from "@/lib/github/load";
import { isReservedRoute, recapPath } from "@/lib/github/username";
import { SITE_ORIGIN } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "./export-menu";
import { Heatmap } from "./heatmap";
import { AppHeader } from "./site-nav";
import {
  ConsistencyRing,
  IntensityBreakdown,
  LanguageDonut,
  MiniSparkBars,
  MonthlyMomentumChart,
  StreakBarcode,
} from "./visual-metrics";
import { WeekdayChart } from "./weekday-chart";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function formatShortDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return iso;
  }
}

function formatDateRangeShort(fromIso: string, toIso: string) {
  if (fromIso === toIso) return formatShortDate(fromIso);
  return `${formatShortDate(fromIso)} – ${formatShortDate(toIso)}`;
}

export function RecapView({ data }: { data: RecapLoaderData }) {
  const navigate = useNavigate();
  const calendar = isGithubFnError(data.calendar) ? null : data.calendar;
  const languages = isGithubFnError(data.languages) ? [] : data.languages.items;
  const split = isGithubFnError(data.split) ? null : data.split;
  const languageError = isGithubFnError(data.languages)
    ? data.languages.error
    : null;
  const splitError = isGithubFnError(data.split) ? data.split.error : null;
  const weekdayRows = calendar
    ? orderWeekdaysMonFirst(weekdayTotals(calendar.days))
    : [];
  const busiest = weekdayRows.length ? busiestWeekday(weekdayRows) : null;
  const cadence = calendar ? consistency(calendar.days) : null;
  const nowYear =
    Number(data.today.slice(0, 4)) || new Date().getUTCFullYear();
  const isPastYear = data.year < nowYear;
  const effectiveToday =
    calendar && isPastYear ? calendar.range.to : data.today;
  const quiet = calendar ? quietStats(calendar.days, effectiveToday) : null;
  const monthlyRollups = calendar
    ? monthRollup(calendar.days, effectiveToday).slice(-12)
    : [];
  const peakMonthKey = peakMonthRollup(monthlyRollups)?.key;
  const monthlyRollupItems = monthlyRollups.map((m) => ({
    value: m.total,
    label: `${m.shortLabel}${m.isPartial ? " (partial)" : ""}: ${formatCount(m.total)} contributions`,
    highlighted: m.key === peakMonthKey && m.total > 0,
  }));
  const streakRange = calendar
    ? (calendar.stats.longestStreakRange ?? longestStreakWindow(calendar.days))
    : null;
  const login = calendar?.profile.login ?? data.username;
  const profileTo = isReservedRoute(login) ? "/u/$username" : "/$username";
  const recapTo = isReservedRoute(login)
    ? "/u/$username/$year"
    : "/$username/$year";
  const entry = calendar ? boardEntryFromCalendar(login, calendar) : null;
  const tier = entry ? classifyTier(entry.score.total) : null;
  const recapYears = [nowYear, nowYear - 1, nowYear - 2, nowYear - 3];

  const openDayView = (iso: string) => {
    void navigate({
      to: profileTo,
      params: { username: login },
      search: { d: iso, range: data.year },
    });
  };

  return (
    <div
      data-charts-ready="true"
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 overflow-x-hidden px-3.5 py-4 sm:gap-6 sm:px-6 sm:py-8"
    >
      <header className="flex flex-col gap-3.5 sm:gap-5">
        <AppHeader subtitle="Year recap" compareUsername={login} activeUsername={login} />

        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
            {calendar?.profile.avatarUrl ? (
              <img
                src={calendar.profile.avatarUrl}
                alt=""
                className="size-11 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/15 sm:size-12"
              />
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-xl font-bold tracking-tight sm:text-3xl">
                  {calendar?.profile.name || login} · {data.year}
                </h1>
                {tier ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tier.tone}`}
                  >
                    {tier.label} Tier
                  </span>
                ) : null}
                {entry ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground/90">
                    {entry.archetype.label}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                @{login}
              </p>
            </div>
          </div>

          <div className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 sm:w-auto sm:flex-wrap sm:gap-2 sm:pb-0">
            <div className="flex shrink-0 items-center gap-1">
              {recapYears.map((y) => (
                <Button
                  key={y}
                  asChild
                  size="sm"
                  className="shrink-0 font-mono tabular-nums"
                  variant={data.year === y ? "default" : "outline"}
                >
                  <Link
                    to={recapTo}
                    params={{ username: login, year: String(y) }}
                  >
                    {y}
                  </Link>
                </Button>
              ))}
            </div>
            {calendar ? (
              <div className="shrink-0">
                <ExportMenu calendar={calendar} year={data.year} />
              </div>
            ) : null}
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link
                to={profileTo}
                params={{ username: login }}
                search={{ range: data.year }}
              >
                <ArrowLeft />
                Day view
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {isGithubFnError(data.calendar) ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-border)] sm:p-5">
          {data.calendar.error}
        </p>
      ) : null}

      {calendar ? (
        <>
          {entry && tier ? (
            <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent/15 text-accent outline outline-1 -outline-offset-1 outline-accent/30">
                    <span className="font-mono text-lg leading-none font-semibold tabular-nums">
                      {entry.score.total}
                    </span>
                    <span className="font-mono text-[9px] text-accent/80">
                      /100
                    </span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 font-display text-base font-semibold">
                        <Zap className="size-3.5 text-accent" />
                        {data.year} Cadence Score
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tier.tone}`}
                      >
                        {tier.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.archetype.label} ·{" "}
                      <span className="font-mono tabular-nums">
                        {Math.round(entry.consistency * 100)}%
                      </span>{" "}
                      active shipping days
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-80 sm:grid-cols-4">
                  <div className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Consistency
                    </p>
                    <p className="font-mono text-xs font-semibold text-accent tabular-nums">
                      {entry.score.consistencyPts}/35
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Streak
                    </p>
                    <p className="font-mono text-xs font-semibold text-heat-3 tabular-nums">
                      {entry.score.streakPts}/25
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Output
                    </p>
                    <p className="font-mono text-xs font-semibold text-foreground tabular-nums">
                      {entry.score.outputPts}/25
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Rhythm
                    </p>
                    <p className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                      {entry.score.rhythmPts}/15
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-heat-0 p-0.5">
                <div
                  className="h-full bg-heat-4 transition-all"
                  style={{ width: `${entry.score.consistencyPts}%` }}
                />
                <div
                  className="h-full bg-heat-3 transition-all"
                  style={{ width: `${entry.score.streakPts}%` }}
                />
                <div
                  className="h-full bg-heat-2 transition-all"
                  style={{ width: `${entry.score.outputPts}%` }}
                />
                <div
                  className="h-full bg-heat-1 transition-all"
                  style={{ width: `${entry.score.rhythmPts}%` }}
                />
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <RecapStat
              icon={<Sparkles />}
              label="Contributions"
              value={formatCount(calendar.stats.total)}
              hint={`${data.year} total`}
              visual={<MiniSparkBars items={monthlyRollupItems} />}
            />
            <RecapStat
              icon={<Flame />}
              label="Longest streak"
              value={`${calendar.stats.longestStreak}d`}
              hint={
                streakRange
                  ? formatDateRangeShort(streakRange.start, streakRange.end)
                  : "No active streak"
              }
            />
            <RecapStat
              icon={<Award />}
              label="Active days"
              value={formatCount(calendar.stats.activeDays)}
              hint={
                cadence
                  ? `${Math.round(cadence.activeRatio * 100)}% of year`
                  : undefined
              }
              visual={
                cadence ? (
                  <div className="w-12 sm:w-14">
                    <div className="h-2 overflow-hidden rounded-full bg-heat-0">
                      <div
                        className="h-full rounded-full bg-heat-3"
                        style={{
                          width: `${Math.min(100, Math.round(cadence.activeRatio * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null
              }
            />
            <RecapStat
              icon={<Trophy />}
              label="Best day"
              value={
                calendar.stats.bestDay
                  ? `${formatCount(calendar.stats.bestDay.count)}`
                  : "—"
              }
              hint={
                calendar.stats.bestDay
                  ? format(parseISO(calendar.stats.bestDay.date), "d MMM")
                  : undefined
              }
              onClick={
                calendar.stats.bestDay
                  ? () => openDayView(calendar.stats.bestDay!.date)
                  : undefined
              }
            />
          </section>

          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold">
                  {data.year} map
                </h2>
                <span className="rounded-full bg-heat-2/35 px-2.5 py-0.5 font-mono text-xs text-accent tabular-nums">
                  {formatCount(calendar.stats.total)} contributions
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                  {calendar.stats.activeDays}d active
                </span>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground tabular-nums">
                <CalendarDays className="size-3.5" />
                {calendar.range.from} – {calendar.range.to}
              </span>
            </div>
            <Heatmap days={calendar.days} onSelect={openDayView} />
          </section>

          <section className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:gap-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold">
                Consistency & intensity
              </h2>
              {cadence ? (
                <>
                  <ConsistencyRing
                    activeRatio={cadence.activeRatio}
                    activeDays={cadence.activeDays}
                    totalDays={cadence.totalDays}
                    avgOnActive={cadence.avgOnActive}
                    days={calendar.days}
                  />
                  <IntensityBreakdown days={calendar.days} />
                  {quiet ? (
                    <StreakBarcode
                      days={calendar.days}
                      quiet={quiet}
                      longestStreak={calendar.stats.longestStreak}
                      currentStreak={calendar.stats.currentStreak}
                      onSelectDate={openDayView}
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:gap-5 sm:p-6">
              <MonthlyMomentumChart
                days={calendar.days}
                today={effectiveToday}
                onSelectMonth={(iso) => {
                  const match = calendar.days.find(
                    (d) => d.date.slice(0, 7) === iso.slice(0, 7),
                  );
                  if (match) openDayView(match.date);
                }}
              />
              <div className="border-t border-border pt-3.5 sm:pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold">
                    Weekday rhythm
                  </h2>
                  {busiest && busiest.count > 0 ? (
                    <span className="rounded-full bg-heat-2/35 px-2.5 py-0.5 font-mono text-xs text-accent tabular-nums">
                      Peak: {busiest.label} · {formatCount(busiest.count)}
                    </span>
                  ) : null}
                </div>
                <WeekdayChart rows={weekdayRows} />
              </div>
            </div>
          </section>

          <section className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">
                  Language mix
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Top public repos
                </span>
              </div>
              {languageError ? (
                <p className="text-sm text-muted-foreground">{languageError}</p>
              ) : languages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No public primary languages.
                </p>
              ) : (
                <LanguageDonut languages={languages} />
              )}
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">
                    Commits vs PRs
                  </h2>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {data.year} public search
                  </span>
                </div>
                {splitError ? (
                  <p className="text-sm text-muted-foreground">{splitError}</p>
                ) : split ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="rounded-xl bg-secondary/50 p-3.5 shadow-[var(--shadow-border)] sm:p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Commits</span>
                          <GitCommitHorizontal className="size-4 text-accent" />
                        </div>
                        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-4xl">
                          {formatCount(split.commits)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-secondary/50 p-3.5 shadow-[var(--shadow-border)] sm:p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Pull requests</span>
                          <GitPullRequest
                            className="size-4"
                            style={{ color: "#38bdf8" }}
                          />
                        </div>
                        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-4xl">
                          {formatCount(split.pullRequests)}
                        </p>
                      </div>
                    </div>
                    {split.commits + split.pullRequests > 0 ? (
                      <div className="space-y-2 rounded-xl bg-secondary/30 p-3.5 shadow-[var(--shadow-border)]">
                        <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                          <span className="inline-flex items-center gap-1.5 text-accent">
                            <span className="size-2 rounded-full bg-heat-4" />
                            Commits{" "}
                            {Math.round(
                              (split.commits /
                                (split.commits + split.pullRequests)) *
                                100,
                            )}
                            %
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ color: "#38bdf8" }}
                          >
                            PRs{" "}
                            {Math.round(
                              (split.pullRequests /
                                (split.commits + split.pullRequests)) *
                                100,
                            )}
                            %
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: "#38bdf8" }}
                            />
                          </span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-heat-0 p-0.5">
                          <div
                            className="h-full rounded-l-full bg-heat-4"
                            style={{
                              width: `${(split.commits / (split.commits + split.pullRequests)) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full rounded-r-full"
                            style={{
                              width: `${(split.pullRequests / (split.commits + split.pullRequests)) * 100}%`,
                              backgroundColor: "#38bdf8",
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 font-mono text-xs text-muted-foreground">
                <span className="truncate">
                  {SITE_ORIGIN}{recapPath(login, data.year)}
                </span>
                {quiet?.busiestMonth ? (
                  <span className="shrink-0 text-accent">
                    Peak: {quiet.busiestMonth.label}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function RecapStat({
  icon,
  label,
  value,
  hint,
  visual,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  visual?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
        <span className="text-accent [&_svg]:size-3.5 sm:[&_svg]:size-4">
          {icon}
        </span>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2 sm:mt-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground sm:mt-1.5">
              {hint}
            </p>
          ) : null}
        </div>
        {visual ? <div className="shrink-0">{visual}</div> : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-2xl bg-card p-3.5 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/60 sm:p-5"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] sm:p-5">
      {inner}
    </div>
  );
}
