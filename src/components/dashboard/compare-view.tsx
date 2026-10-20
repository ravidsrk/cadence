import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, GitCompareArrows, Trophy } from "lucide-react";
import { boardEntryFromCalendar, classifyTier } from "@/lib/github/board";
import { compareDelta } from "@/lib/github/compare";
import {
  consistency,
  orderWeekdaysMonFirst,
  weekdayTotals,
} from "@/lib/github/insights";
import { quietStats } from "@/lib/github/gaps";
import {
  isGithubFnError,
  type CalendarPayload,
  type GithubFnError,
} from "@/lib/github/types";
import { normalizeUsername, profileRoute } from "@/lib/github/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heatmap } from "./heatmap";
import { AppHeader } from "./site-nav";
import { HeadToHeadCharts, IntensityBreakdown } from "./visual-metrics";
import { cn } from "@/lib/utils";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function currentYear() {
  return new Date().getUTCFullYear();
}

const YEAR_OPTIONS: Array<number | undefined> = [
  undefined,
  currentYear(),
  currentYear() - 1,
  currentYear() - 2,
];

const COMPARE_PRESETS: Array<[string, string]> = [
  ["gaearon", "yyx990803"],
  ["torvalds", "sindresorhus"],
  ["ravidsrk", "gaearon"],
];

export function CompareForm({
  leftDefault = "",
  rightDefault = "",
  year,
}: {
  leftDefault?: string;
  rightDefault?: string;
  year?: number;
}) {
  const navigate = useNavigate();
  const [left, setLeft] = useState(leftDefault);
  const [right, setRight] = useState(rightDefault);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLeft(leftDefault);
  }, [leftDefault]);

  useEffect(() => {
    setRight(rightDefault);
  }, [rightDefault]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const a = normalizeUsername(left);
    const b = normalizeUsername(right);
    if (!a || !b) {
      setError("Enter two GitHub usernames or profile URLs.");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError("Pick two different users.");
      return;
    }
    setError(null);
    void navigate({
      to: "/compare/$a/$b",
      params: { a, b },
      search: year ? { y: year } : {},
    });
  }

  function swapUsers() {
    setLeft(right);
    setRight(left);
    setError(null);
    const a = normalizeUsername(right);
    const b = normalizeUsername(left);
    if (a && b && a.toLowerCase() !== b.toLowerCase()) {
      void navigate({
        to: "/compare/$a/$b",
        params: { a, b },
        search: year ? { y: year } : {},
      });
    }
  }

  return (
    <div className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] sm:p-5">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3"
      >
        <div className="flex flex-1 flex-col gap-1.5 min-[480px]:flex-row min-[480px]:items-center sm:gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-xs text-muted-foreground select-none sm:left-3">
              @
            </span>
            <Input
              value={left}
              onChange={(e) => {
                setLeft(e.target.value);
                setError(null);
              }}
              placeholder="first user"
              aria-label="First GitHub username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="pl-6 font-mono sm:pl-7"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={swapUsers}
            aria-label="Swap users"
            title="Swap users"
            className="size-8 shrink-0 self-center min-[480px]:size-9 sm:size-10"
          >
            <ArrowLeftRight className="size-4" />
          </Button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-xs text-muted-foreground select-none sm:left-3">
              @
            </span>
            <Input
              value={right}
              onChange={(e) => {
                setRight(e.target.value);
                setError(null);
              }}
              placeholder="second user"
              aria-label="Second GitHub username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="pl-6 font-mono sm:pl-7"
            />
          </div>
        </div>
        <Button type="submit" className="w-full shrink-0 lg:w-fit">
          <GitCompareArrows />
          Compare
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-accent">{error}</p> : null}
      <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs text-muted-foreground sm:mt-3">
        <span className="mr-0.5 shrink-0 font-medium">Quick pairs:</span>
        {COMPARE_PRESETS.map(([u1, u2]) => {
          const isCurrent =
            left.toLowerCase() === u1.toLowerCase() &&
            right.toLowerCase() === u2.toLowerCase();
          return (
            <Link
              key={`${u1}-${u2}`}
              to="/compare/$a/$b"
              params={{ a: u1, b: u2 }}
              search={year ? { y: year } : {}}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 font-mono text-xs transition-colors",
                isCurrent
                  ? "bg-accent/20 text-accent shadow-[var(--shadow-border)]"
                  : "bg-secondary/70 text-foreground/85 hover:bg-secondary hover:text-foreground",
              )}
            >
              {u1} vs {u2}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CompareView({
  a,
  b,
  left,
  right,
  year,
}: {
  a: string;
  b: string;
  left: CalendarPayload | GithubFnError;
  right: CalendarPayload | GithubFnError;
  year?: number;
}) {
  const navigate = useNavigate();
  const rangeLabel = year ? String(year) : "Last 12 months";
  const leftOk = !isGithubFnError(left);
  const rightOk = !isGithubFnError(right);
  const leftConsistency = leftOk ? consistency(left.days).activeRatio : 0;
  const rightConsistency = rightOk ? consistency(right.days).activeRatio : 0;
  const leftBoard = leftOk
    ? boardEntryFromCalendar(left.profile.login, left)
    : null;
  const rightBoard = rightOk
    ? boardEntryFromCalendar(right.profile.login, right)
    : null;
  const delta =
    leftOk && rightOk
      ? compareDelta(
          {
            login: left.profile.login,
            total: left.stats.total,
            streak: left.stats.currentStreak,
            consistency: leftConsistency,
          },
          {
            login: right.profile.login,
            total: right.stats.total,
            streak: right.stats.currentStreak,
            consistency: rightConsistency,
          },
        )
      : null;

  const rawRatios: Record<"total" | "streak" | "consistency", number> =
    leftOk && rightOk
      ? {
          total:
            left.stats.total + right.stats.total > 0
              ? (left.stats.total / (left.stats.total + right.stats.total)) *
                100
              : 50,
          streak:
            left.stats.currentStreak + right.stats.currentStreak > 0
              ? (left.stats.currentStreak /
                  (left.stats.currentStreak + right.stats.currentStreak)) *
                100
              : 50,
          consistency:
            leftConsistency + rightConsistency > 0
              ? (leftConsistency / (leftConsistency + rightConsistency)) * 100
              : 50,
        }
      : { total: 50, streak: 50, consistency: 50 };

  function pickYear(next: number | undefined) {
    void navigate({
      to: "/compare/$a/$b",
      params: { a, b },
      search: next ? { y: next } : {},
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 overflow-x-hidden px-3.5 py-4 sm:gap-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3.5 sm:gap-5">
        <AppHeader subtitle="Compare calendars" compareUsername={a} />

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="space-y-0.5">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-4xl">
              {a} <span className="font-normal text-muted-foreground">vs</span>{" "}
              {b}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Head-to-head cadence comparison · {rangeLabel}
            </p>
          </div>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:pb-0">
            {YEAR_OPTIONS.map((y) => {
              const label = y ? String(y) : "Last 12 months";
              const shortLabel = y ? String(y) : "Last 12m";
              const active = year === y;
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  className="shrink-0"
                  variant={active ? "default" : "outline"}
                  onClick={() => pickYear(y)}
                >
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </header>

      <CompareForm leftDefault={a} rightDefault={b} year={year} />

      {leftBoard && rightBoard ? (
        <section className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-accent" />
              <h2 className="font-display text-base font-semibold sm:text-lg">
                Composite Cadence Score (0–100)
              </h2>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs text-foreground tabular-nums">
              {leftBoard.score.total === rightBoard.score.total
                ? "Tied Score"
                : leftBoard.score.total > rightBoard.score.total
                  ? `${leftBoard.username} +${leftBoard.score.total - rightBoard.score.total} pts`
                  : `${rightBoard.username} +${rightBoard.score.total - leftBoard.score.total} pts`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr] sm:items-center">
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 sm:flex-col sm:items-start sm:gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  @{leftBoard.username}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    classifyTier(leftBoard.score.total).tone,
                  )}
                >
                  {classifyTier(leftBoard.score.total).label}
                </span>
                <span className="rounded-full bg-heat-4/20 px-2 py-0.5 text-[11px] font-medium text-accent">
                  {leftBoard.archetype.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-mono text-2xl font-semibold text-accent tabular-nums sm:text-3xl">
                  {leftBoard.score.total}
                  <span className="text-xs font-normal text-muted-foreground">
                    /100
                  </span>
                </p>
                {leftBoard.momentumDelta !== null &&
                Math.abs(leftBoard.momentumDelta) >= 3 ? (
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {leftBoard.momentumDelta > 0 ? "▲+" : "▼"}
                    {leftBoard.momentumDelta}% 30d
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-secondary/25 p-3">
              {(
                [
                  {
                    label: "Consistency (35)",
                    l: leftBoard.score.consistencyPts,
                    r: rightBoard.score.consistencyPts,
                    max: 35,
                  },
                  {
                    label: "Streak (25)",
                    l: leftBoard.score.streakPts,
                    r: rightBoard.score.streakPts,
                    max: 25,
                  },
                  {
                    label: "Log output (25)",
                    l: leftBoard.score.outputPts,
                    r: rightBoard.score.outputPts,
                    max: 25,
                  },
                  {
                    label: "Rhythm (15)",
                    l: leftBoard.score.rhythmPts,
                    r: rightBoard.score.rhythmPts,
                    max: 15,
                  },
                ] as const
              ).map((pillar) => {
                const lPct = Math.round((pillar.l / pillar.max) * 100);
                const rPct = Math.round((pillar.r / pillar.max) * 100);
                return (
                  <div key={pillar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-accent tabular-nums">
                        {pillar.l}
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {pillar.label}
                      </span>
                      <span className="font-mono font-medium text-sky-300 tabular-nums">
                        {pillar.r}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-heat-0">
                        <div
                          className="h-full rounded-full bg-heat-4"
                          style={{ width: `${lPct}%` }}
                        />
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-heat-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${rPct}%`,
                            backgroundColor: "#38bdf8",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 sm:flex-col sm:items-end sm:gap-1.5">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                  {rightBoard.archetype.label}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    classifyTier(rightBoard.score.total).tone,
                  )}
                >
                  {classifyTier(rightBoard.score.total).label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  @{rightBoard.username}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {rightBoard.momentumDelta !== null &&
                Math.abs(rightBoard.momentumDelta) >= 3 ? (
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {rightBoard.momentumDelta > 0 ? "▲+" : "▼"}
                    {rightBoard.momentumDelta}% 30d
                  </span>
                ) : null}
                <p className="font-mono text-2xl font-semibold text-sky-300 tabular-nums sm:text-3xl">
                  {rightBoard.score.total}
                  <span className="text-xs font-normal text-muted-foreground">
                    /100
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {delta ? (
        <section className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
          {delta.map((row) => {
            const leftShare = rawRatios[row.key];
            return (
              <div
                key={row.key}
                className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {row.label}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums",
                      row.leader === "tie"
                        ? "bg-secondary text-muted-foreground"
                        : row.leader === "left"
                          ? "bg-accent/15 text-accent"
                          : "bg-sky-400/15 text-sky-300",
                    )}
                  >
                    {row.note}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between font-mono text-lg tabular-nums sm:mt-2.5 sm:text-xl">
                  <span
                    className={
                      row.leader === "left"
                        ? "font-semibold text-accent"
                        : "text-muted-foreground"
                    }
                  >
                    {row.leftValue}
                  </span>
                  <span className="font-sans text-xs text-muted-foreground">
                    vs
                  </span>
                  <span
                    className={
                      row.leader === "right"
                        ? "font-semibold text-sky-300"
                        : "text-muted-foreground"
                    }
                  >
                    {row.rightValue}
                  </span>
                </div>
                <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-heat-0 p-0.5 sm:mt-3">
                  <div
                    className="h-full rounded-l-full bg-heat-4 transition-all duration-300"
                    style={{ width: `${leftShare}%` }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all duration-300"
                    style={{
                      width: `${100 - leftShare}%`,
                      backgroundColor: "#38bdf8",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {leftOk && rightOk ? (
        <HeadToHeadCharts
          leftLogin={left.profile.login}
          rightLogin={right.profile.login}
          leftDays={left.days}
          rightDays={right.days}
          leftWeekday={orderWeekdaysMonFirst(weekdayTotals(left.days))}
          rightWeekday={orderWeekdaysMonFirst(weekdayTotals(right.days))}
        />
      ) : null}

      <section className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
        <CompareColumn
          username={a}
          calendar={left}
          accentColor="#39d353"
          theme="emerald"
        />
        <CompareColumn
          username={b}
          calendar={right}
          accentColor="#38bdf8"
          theme="sky"
        />
      </section>
    </div>
  );
}

function CompareColumn({
  username,
  calendar,
  accentColor,
  theme,
}: {
  username: string;
  calendar: CalendarPayload | GithubFnError;
  accentColor: string;
  theme: "emerald" | "sky";
}) {
  if (isGithubFnError(calendar)) {
    return (
      <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-border)] sm:p-5">
        <p className="font-mono text-xs font-semibold text-foreground">
          @{username}
        </p>
        <p className="mt-1">{calendar.error}</p>
      </div>
    );
  }
  const cadence = consistency(calendar.days);
  const quiet = quietStats(calendar.days, calendar.range.to);
  const login = calendar.profile.login;
  const profileTo = profileRoute(login);
  return (
    <div className="space-y-3.5 overflow-hidden rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:space-y-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={calendar.profile.avatarUrl}
              alt=""
              className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
            />
            <span
              className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card"
              style={{ backgroundColor: accentColor }}
            />
          </div>
          <div className="min-w-0">
            <Link
              to={profileTo}
              params={{ username: login }}
              className="block truncate font-display font-semibold hover:underline"
            >
              {calendar.profile.name || login}
            </Link>
            <p className="truncate font-mono text-xs text-muted-foreground">
              @{login}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to={profileTo} params={{ username: login }}>
            Open {username}
          </Link>
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/45 p-2.5 text-sm shadow-[var(--shadow-border)] sm:gap-3 sm:p-3.5">
        <Stat label="Contributions" value={formatCount(calendar.stats.total)} />
        <Stat label="Streak" value={`${calendar.stats.currentStreak}d`} />
        <Stat label="Longest" value={`${calendar.stats.longestStreak}d`} />
        <Stat
          label="Consistency"
          value={`${Math.round(cadence.activeRatio * 100)}%`}
        />
        <Stat
          label="Active days"
          value={formatCount(calendar.stats.activeDays)}
        />
        <Stat
          label="Current pause"
          value={quiet.currentPause === 0 ? "0" : `${quiet.currentPause}d`}
        />
      </dl>
      <IntensityBreakdown days={calendar.days} />
      <Heatmap days={calendar.days} compact theme={theme} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums sm:mt-1 sm:text-base">
        {value}
      </dd>
    </div>
  );
}
