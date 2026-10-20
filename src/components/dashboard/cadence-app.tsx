import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  GitCommitHorizontal,
  Plus,
  RotateCcw,
  Trophy,
  UserX,
  X,
} from "lucide-react";
import { addBoard, getCalendar, getDayCommits } from "@/lib/github/api";
import {
  boardEntryFromCalendar,
  classifyTier,
  type BuilderArchetypeId,
  type ScoreBreakdown,
} from "@/lib/github/board";
import {
  monthRollup,
  peakMonthRollup,
  quietStats,
} from "@/lib/github/gaps";
import {
  busiestWeekday,
  consistency,
  orderWeekdaysMonFirst,
  profilePermalink,
  shareText,
  weekdayTotals,
} from "@/lib/github/insights";
import { shiftDate } from "@/lib/github/layout";
import {
  addRecentProfile,
  FEATURED_PROFILES,
  formatRelativeTimeAgo,
  readClientStaleCalendar,
  saveCachedProfileSummary,
  saveClientStaleCalendar,
} from "@/lib/github/recent";
import { cadenceSearchFromState } from "@/lib/github/search";
import { longestStreakWindow } from "@/lib/github/stats";
import {
  isGithubFnError,
  type CalendarLoaderData,
  type CalendarPayload,
  type DayCount,
  type GithubFnError,
} from "@/lib/github/types";
import {
  isReservedRoute,
  parseGithubUsername,
  profilePath,
  profileRoute,
  resolveSelectedDate,
} from "@/lib/github/username";
import { SITE_ORIGIN } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CountPair, InfoTooltip } from "./count-pair";
import { ExportMenu } from "./export-menu";
import { Heatmap, type HeatmapViewMode } from "./heatmap";
import { AppHeader } from "./site-nav";
import {
  ConsistencyRing,
  IntensityBreakdown,
  MiniSparkBars,
  MonthlyMomentumChart,
  StreakBarcode,
} from "./visual-metrics";
import { WeekChart } from "./week-chart";
import { WeekdayChart } from "./weekday-chart";

const STORAGE_KEY = "cadence:username";
const VIEW_STORAGE_KEY = "cadence:view";
export const DEFAULT_USER = "ravidsrk";
const UNAVAILABLE_CALENDAR_ERROR: GithubFnError = {
  error: "Could not load the calendar.",
  code: "unavailable",
};

const TIER_THRESHOLDS = [
  { label: "Apex", range: "82–100", desc: "Top percentile consistency, streak, and daily volume" },
  { label: "Diamond", range: "68–81", desc: "High-frequency shipping with strong active-day rhythm" },
  { label: "Gold", range: "52–67", desc: "Sustained weekly momentum and reliable output" },
  { label: "Silver", range: "36–51", desc: "Regular contributions with periodic rest windows" },
  { label: "Bronze", range: "0–35", desc: "Emerging or burst-oriented contribution cadence" },
] as const;

const ARCHETYPE_DESCRIPTIONS: Record<BuilderArchetypeId, string> = {
  relentless: "Active on 72%+ of calendar days with an ongoing multi-week streak.",
  surging: "Recent contribution momentum is surging 25%+ over the prior window.",
  marathoner: "Sustained long-horizon streaks and high active-day consistency.",
  "high-output": "High daily contribution pace across active shipping days.",
  "peak-striker": "Concentrated high-volume shipping bursts on peak days.",
  steady: "Consistent, balanced contribution cadence across the period.",
};

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export function CadenceApp({
  initial,
  routeUsername,
  dateFromUrl,
  yearFromUrl,
  viewFromUrl,
  forceSkeleton = false,
}: {
  initial: CalendarLoaderData;
  routeUsername?: string;
  dateFromUrl?: string;
  yearFromUrl?: number;
  viewFromUrl?: HeatmapViewMode;
  forceSkeleton?: boolean;
}) {
  const navigate = useNavigate();
  const today = initial.today;
  const todayYear = Number(today.slice(0, 4));
  const defaultDateForYear = (y: number | undefined) =>
    y && y < todayYear ? `${y}-12-31` : today;
  const [username, setUsername] = useState(initial.username);
  if (routeUsername && username !== initial.username) {
    setUsername(initial.username);
  }
  const [selectedDate, setSelectedDate] = useState(() =>
    resolveSelectedDate(dateFromUrl, yearFromUrl, today),
  );
  const [year, setYear] = useState<number | undefined>(yearFromUrl);
  const [viewMode, setViewMode] = useState<HeatmapViewMode>(
    viewFromUrl ?? "2d",
  );
  const [calendarPopoverOpen, setCalendarPopoverOpen] = useState(false);
  const [boardAdding, setBoardAdding] = useState(false);
  const [clientStaleFallback, setClientStaleFallback] = useState<{
    payload: CalendarPayload;
    updatedAt: number;
  } | null>(null);
  const [skeletonOverride, setSkeletonOverride] = useState(forceSkeleton);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setSkeletonOverride(forceSkeleton || params.get("skeleton") === "1");
  }, [forceSkeleton]);

  useEffect(() => {
    const nextView = viewFromUrl ?? "2d";
    setViewMode(nextView);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch {
      // ignore storage errors
    }
  }, [viewFromUrl]);

  useEffect(() => {
    setUsername(initial.username);
  }, [initial.username, routeUsername]);

  useEffect(() => {
    setYear(yearFromUrl);
    setSelectedDate(resolveSelectedDate(dateFromUrl, yearFromUrl, today));
  }, [dateFromUrl, today, yearFromUrl]);

  const seededCalendar =
    !forceSkeleton &&
    !skeletonOverride &&
    initial.calendar &&
    !isGithubFnError(initial.calendar) &&
    username.toLowerCase() === initial.username.toLowerCase() &&
    year === yearFromUrl
      ? initial.calendar
      : undefined;

  const seededError =
    !forceSkeleton &&
    !skeletonOverride &&
    initial.calendar &&
    isGithubFnError(initial.calendar) &&
    username.toLowerCase() === initial.username.toLowerCase() &&
    year === yearFromUrl
      ? initial.calendar
      : undefined;

  const calendarQuery = useQuery({
    queryKey: ["calendar", username.toLowerCase(), year, today],
    queryFn: () => getCalendar({ data: { username, year, today } }),
    enabled: Boolean(username) && !skeletonOverride && !forceSkeleton,
    staleTime: 60_000,
    initialData: seededCalendar ?? seededError,
  });

  const liveCalendar =
    !skeletonOverride &&
    !forceSkeleton &&
    calendarQuery.data &&
    !isGithubFnError(calendarQuery.data)
      ? calendarQuery.data
      : seededCalendar ?? null;

  const calendarError =
    !skeletonOverride &&
    !forceSkeleton &&
    calendarQuery.data &&
    isGithubFnError(calendarQuery.data)
      ? calendarQuery.data
      : !skeletonOverride && !forceSkeleton && calendarQuery.error
        ? UNAVAILABLE_CALENDAR_ERROR
        : seededError ?? null;

  useEffect(() => {
    const expectedUser = (routeUsername ?? username).toLowerCase();
    if (
      liveCalendar &&
      liveCalendar.profile.login.toLowerCase() === expectedUser
    ) {
      addRecentProfile(liveCalendar.profile.login);
      saveCachedProfileSummary(liveCalendar);
      saveClientStaleCalendar(liveCalendar.profile.login, year, liveCalendar);
      setClientStaleFallback(null);
      try {
        localStorage.setItem(STORAGE_KEY, liveCalendar.profile.login);
      } catch {
        // ignore
      }
      if (typeof document !== "undefined") {
        const display = liveCalendar.profile.name
          ? `${liveCalendar.profile.name} (@${liveCalendar.profile.login})`
          : `@${liveCalendar.profile.login}`;
        document.title = `${display} · Cadence`;
      }
      if (typeof window !== "undefined") {
        const canonicalPath = profilePath(liveCalendar.profile.login);
        if (window.location.pathname !== canonicalPath) {
          window.history.replaceState(
            window.history.state,
            "",
            `${canonicalPath}${window.location.search}${window.location.hash}`,
          );
        }
      }
    } else if (
      calendarError &&
      (calendarError.code === "rate_limit" ||
        calendarError.code === "unavailable")
    ) {
      if (calendarError.staleCalendar) {
        setClientStaleFallback({
          payload: calendarError.staleCalendar,
          updatedAt: calendarError.staleUpdatedAt ?? Date.now(),
        });
      } else {
        setClientStaleFallback(readClientStaleCalendar(username, year));
      }
    } else {
      setClientStaleFallback(null);
    }
  }, [calendarError, liveCalendar, routeUsername, username, year]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const staleEntry = calendarError?.staleCalendar
    ? {
        payload: calendarError.staleCalendar,
        updatedAt: calendarError.staleUpdatedAt ?? null,
      }
    : (clientStaleFallback ?? null);
  const calendar: CalendarPayload | null =
    liveCalendar ?? staleEntry?.payload ?? null;
  const calendarPending =
    skeletonOverride || (calendarQuery.isPending && !calendar && !calendarError);

  const initialDefaultDate = resolveSelectedDate(
    dateFromUrl,
    yearFromUrl,
    today,
  );

  const commitsQuery = useQuery({
    queryKey: ["commits", username.toLowerCase(), selectedDate],
    queryFn: () => getDayCommits({ data: { username, date: selectedDate } }),
    enabled:
      Boolean(username) &&
      Boolean(selectedDate) &&
      !calendarError &&
      !skeletonOverride &&
      !forceSkeleton,
    staleTime: 60_000,
    initialData:
      !forceSkeleton &&
      !skeletonOverride &&
      username.toLowerCase() === initial.username.toLowerCase() &&
      selectedDate === initialDefaultDate &&
      initial.commits &&
      !isGithubFnError(initial.commits)
        ? initial.commits
        : undefined,
  });

  const commits =
    !skeletonOverride &&
    !forceSkeleton &&
    commitsQuery.data &&
    !isGithubFnError(commitsQuery.data)
      ? commitsQuery.data
      : !skeletonOverride &&
          !forceSkeleton &&
          username.toLowerCase() === initial.username.toLowerCase() &&
          selectedDate === initialDefaultDate &&
          initial.commits &&
          !isGithubFnError(initial.commits)
        ? initial.commits
        : null;
  const commitsError =
    !skeletonOverride &&
    commitsQuery.data &&
    isGithubFnError(commitsQuery.data)
      ? commitsQuery.data
      : !skeletonOverride && commitsQuery.error
        ? {
            error: "Could not load commit details for that day.",
            code: "unavailable" as const,
          }
        : null;

  const [chartErrors, setChartErrors] = useState<
    Partial<Record<"week" | "monthly" | "weekday", string>>
  >({});

  useEffect(() => {
    function onChartError(e: Event) {
      const detail = (
        e as CustomEvent<{
          chart?: "week" | "monthly" | "weekday";
          error?: string | null;
        }>
      ).detail;
      if (!detail?.chart) return;
      setChartErrors((prev) => {
        const next = { ...prev };
        if (detail.error) next[detail.chart!] = detail.error;
        else delete next[detail.chart!];
        return next;
      });
    }
    window.addEventListener("cadence:chart-error", onChartError);
    return () =>
      window.removeEventListener("cadence:chart-error", onChartError);
  }, []);

  async function retryChart(chart: "week" | "monthly" | "weekday") {
    try {
      const res = await calendarQuery.refetch({ throwOnError: true });
      const data = res.data;
      if (data && !isGithubFnError(data)) {
        setChartErrors((prev) => {
          const next = { ...prev };
          delete next[chart];
          return next;
        });
      } else if (data && isGithubFnError(data)) {
        const errText = data.error;
        setChartErrors((prev) => ({
          ...prev,
          [chart]: errText,
        }));
      }
    } catch {
      setChartErrors((prev) => ({
        ...prev,
        [chart]: "Network error loading chart data. Check your connection and retry.",
      }));
    }
  }

  const selectedDay: DayCount | undefined = calendar?.days.find(
    (d) => d.date === selectedDate,
  );
  const shareLogin = calendar?.profile.login ?? username;
  const rangeLabel = year ? String(year) : "last 12 months";

  const firstDayInCalendar = calendar?.days[0]?.date;
  const lastDayInCalendar = calendar?.days[calendar.days.length - 1]?.date;
  const canStepPrev = Boolean(
    calendar && firstDayInCalendar && selectedDate > firstDayInCalendar,
  );
  const canStepNext = Boolean(
    calendar && lastDayInCalendar && selectedDate < lastDayInCalendar,
  );

  const syncUrl = useCallback(
    (
      nextDate: string,
      nextYear: number | undefined,
      nextView: HeatmapViewMode = viewMode,
    ) => {
      if (!routeUsername) return;
      const targetUser = calendar?.profile.login ?? routeUsername;
      const to = isReservedRoute(targetUser) ? "/u/$username" : "/$username";
      void navigate({
        to,
        params: { username: targetUser },
        search: cadenceSearchFromState({
          today,
          selectedDate: nextDate,
          year: nextYear,
          view: nextView,
        }),
        replace: true,
      });
    },
    [calendar?.profile.login, navigate, routeUsername, today, viewMode],
  );

  const pickDate = useCallback(
    (iso: string) => {
      if (iso > today) return;
      setSelectedDate(iso);
      if (year && Number(iso.slice(0, 4)) !== year) {
        setYear(Number(iso.slice(0, 4)));
        syncUrl(iso, Number(iso.slice(0, 4)), viewMode);
        return;
      }
      syncUrl(iso, year, viewMode);
    },
    [syncUrl, today, viewMode, year],
  );

  function pickYear(next: number | undefined) {
    setYear(next);
    if (next && next < todayYear) {
      const clamped = `${next}-12-31`;
      setSelectedDate(clamped);
      syncUrl(clamped, next, viewMode);
      return;
    }
    if (
      (!next || next === todayYear) &&
      ((year && year < todayYear) ||
        (next && Number(selectedDate.slice(0, 4)) !== next))
    ) {
      setSelectedDate(today);
      syncUrl(today, next, viewMode);
      return;
    }
    syncUrl(selectedDate, next, viewMode);
  }

  function pickView(next: HeatmapViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    syncUrl(selectedDate, year, next);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest('[role="grid"]'))
      ) {
        return;
      }
      if (!calendar) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        pickDate(shiftDate(calendar.days, selectedDate, -1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        pickDate(shiftDate(calendar.days, selectedDate, 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        const first = calendar.days[0];
        if (first) pickDate(first.date);
      } else if (event.key === "End") {
        event.preventDefault();
        const last = calendar.days[calendar.days.length - 1];
        if (last) pickDate(last.date);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calendar, pickDate, selectedDate]);

  async function copyLink() {
    const url = profilePermalink({
      origin: window.location.origin,
      username: shareLogin,
      today,
      selectedDate,
      year,
      view: viewMode,
    });
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this profile link", url);
    }
  }

  function shareOnX() {
    const url = profilePermalink({
      origin: window.location.origin,
      username: shareLogin,
      today,
      selectedDate,
      year,
      view: viewMode,
    });
    const text = shareText({
      login: shareLogin,
      name: calendar?.profile.name,
      streak: calendar?.stats.currentStreak ?? 0,
      total: calendar?.stats.total ?? 0,
      rangeLabel,
      dayCount: commits?.total,
      dayLabel: format(parseISO(selectedDate), "d MMM yyyy"),
      mergedCount: commits?.mergedTotal,
      url,
    });
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function handleAddToBoard() {
    if (boardAdding) return;
    setBoardAdding(true);
    try {
      await addBoard({ data: { username: shareLogin } });
      await navigate({ to: "/board" });
    } catch {
      await navigate({ to: "/board" });
    } finally {
      setBoardAdding(false);
    }
  }

  if (!calendarPending && calendarError?.code === "not_found") {
    return <ProfileNotFoundView username={routeUsername ?? username} />;
  }

  if (!calendarPending && calendarError?.code === "organization") {
    return (
      <ProfileOrganizationView
        username={routeUsername ?? username}
        message={calendarError.error}
      />
    );
  }

  if (!calendarPending && calendarError && !calendar) {
    return (
      <ProfileApiErrorView
        username={routeUsername ?? username}
        error={calendarError.error}
        isRetrying={calendarQuery.isFetching}
        onRetry={() => void calendarQuery.refetch()}
      />
    );
  }

  const years = [undefined, todayYear, todayYear - 1, todayYear - 2];
  const isPastYear = Boolean(year && year < todayYear);
  const defaultSelectedDate = defaultDateForYear(year);
  const selected = parseISO(selectedDate);
  const weekdayRows = calendar
    ? orderWeekdaysMonFirst(weekdayTotals(calendar.days))
    : [];
  const busiest = weekdayRows.length ? busiestWeekday(weekdayRows) : null;
  const cadence = calendar ? consistency(calendar.days) : null;
  const quiet = calendar
    ? quietStats(calendar.days, isPastYear ? calendar.range.to : today)
    : null;
  const boardSummary = calendar
    ? boardEntryFromCalendar(calendar.profile.login, calendar)
    : null;

  const last7DaysTotal = calendar
    ? isPastYear
      ? calendar.days
          .filter((d) => d.date <= selectedDate)
          .slice(-7)
          .reduce((sum, d) => sum + d.count, 0)
      : calendar.stats.week
    : 0;

  const rangeDateSpan = calendar
    ? `${format(parseISO(calendar.range.from), "d MMM yyyy")} – ${format(parseISO(calendar.range.to), "d MMM yyyy")}`
    : null;

  const monthlyRollups = calendar
    ? monthRollup(calendar.days, today).slice(-12)
    : [];
  const peakMonthKey = peakMonthRollup(monthlyRollups)?.key;
  const monthlySparkItems = monthlyRollups.map((m) => ({
    value: m.total,
    label: `${m.shortLabel}${m.isPartial ? " (partial)" : ""}: ${formatCount(m.total)} contributions`,
    highlighted: m.key === peakMonthKey && m.total > 0,
  }));

  const streakWindow = calendar
    ? (calendar.stats.longestStreakRange ?? longestStreakWindow(calendar.days))
    : null;
  const streakRangeLabel = streakWindow
    ? streakWindow.start === streakWindow.end
      ? format(parseISO(streakWindow.start), "d MMM")
      : `${format(parseISO(streakWindow.start), "d MMM")} – ${format(parseISO(streakWindow.end), "d MMM")}`
    : null;

  const isEarliestRange = Boolean(year && year <= todayYear - 2);
  const totalChangeInfo = (() => {
    if (!calendar) {
      return { text: "—", className: "text-muted-foreground" };
    }
    const priorTotal = calendar.stats.priorTotal;
    if (isEarliestRange || priorTotal == null || priorTotal <= 0) {
      return { text: "No prior period", className: "text-muted-foreground" };
    }
    const pct = Math.round(
      ((calendar.stats.total - priorTotal) / priorTotal) * 100,
    );
    const sign = pct > 0 ? "+" : "";
    const periodLabel =
      calendar.stats.priorPeriodLabel ??
      (year ? `prior ${year === todayYear ? "year" : "12 months"}` : "prior 12 months");
    const className =
      pct > 0
        ? "font-medium text-accent"
        : pct < 0
          ? "font-medium text-rose-400"
          : "text-muted-foreground";
    return {
      text: `${sign}${pct}% vs ${periodLabel}`,
      className,
    };
  })();

  const chartsReady = !calendarPending;
  const canonicalUserPath = profilePath(shareLogin);
  const effectiveChartError = calendar ? null : calendarError?.error ?? null;

  return (
    <div
      data-charts-ready={chartsReady ? "true" : "false"}
      data-profile-skeleton={calendarPending ? "true" : "false"}
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 overflow-x-hidden px-4 py-5 sm:gap-6 sm:px-6 sm:py-7"
    >
      {/* 1. Header */}
      <header className="flex flex-col gap-3.5 sm:gap-4">
        <AppHeader
          compareUsername={shareLogin}
          activeUsername={shareLogin}
        />
      </header>

      {/* Rate-limit / API error banner when serving cached stale data */}
      {calendarError && calendar ? (
        <div
          data-section="rate-limit-banner"
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-foreground shadow-[var(--shadow-border)] sm:px-5"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>{calendarError.error}</span>
            {staleEntry ? (
              <span
                data-stale-updated="true"
                className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-0.5 font-mono text-[11px] text-amber-300 ring-1 ring-amber-400/30"
              >
                <Clock className="size-3" />
                {hydrated && staleEntry.updatedAt
                  ? formatRelativeTimeAgo(staleEntry.updatedAt)
                  : "Updated recently"}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={calendarQuery.isFetching}
            onClick={() => void calendarQuery.refetch()}
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <RotateCcw className="size-3.5" />
            {calendarQuery.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : null}

      {/* 2. Profile row */}
      {calendar?.profile ? (
        <div
          data-section="profile-row"
          className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <img
              src={calendar.profile.avatarUrl}
              alt=""
              className="size-11 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/15"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="m-0 text-base font-semibold leading-none">
                  <a
                    href={calendar.profile.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 truncate text-base font-semibold text-foreground hover:underline"
                  >
                    {calendar.profile.name ?? calendar.profile.login}
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </h1>
                <span className="font-mono text-xs text-muted-foreground">
                  @{calendar.profile.login}
                </span>
                {boardSummary ? (
                  <ScoreAndArchetypePopover
                    score={boardSummary.score}
                    archetype={boardSummary.archetype}
                  />
                ) : null}
              </div>
              {calendar.profile.bio ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground sm:max-w-xl">
                  {calendar.profile.bio}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ExportMenu
              calendar={calendar}
              year={year}
              onShareX={shareOnX}
              onCopyLink={copyLink}
              recapYear={year ?? todayYear}
              primary
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={boardAdding}
              onClick={() => void handleAddToBoard()}
            >
              <Plus />
              <span>{boardAdding ? "Adding…" : "Add to board"}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div
          data-section="profile-row-skeleton"
          className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5 sm:py-4"
        >
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 sm:w-44" />
              <Skeleton className="h-3 w-24 sm:w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      )}

      {/* Page-level range selector */}
      <div
        data-section="page-range-control"
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-card px-4 py-2.5 shadow-[var(--shadow-border)] sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Range</span>
          {rangeDateSpan ? (
            <span className="font-mono tabular-nums">· {rangeDateSpan}</span>
          ) : calendarPending ? (
            <Skeleton className="h-3.5 w-36" />
          ) : null}
        </div>
        <div
          role="tablist"
          aria-label="Contribution time range"
          className="no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-secondary p-1"
        >
          {years.map((y) => {
            const label = y ? String(y) : "Last 12 months";
            const shortLabel = y ? String(y) : "Last 12m";
            const active = year === y;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                data-range-tab={y ? String(y) : "rolling"}
                aria-selected={active}
                onClick={() => pickYear(y)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-card text-accent shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Year summary strip (4-column hero grid -> 2 below 900px -> 1 below 480px) */}
      <section
        data-section="year-summary-strip"
        aria-label="Year summary statistics"
        className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 min-[900px]:grid-cols-4 sm:gap-4"
      >
        <StatCard
          icon={<GitCommitHorizontal />}
          label="Total contributions"
          tooltip="Total GitHub contributions recorded across the selected range. Sparkline shows 12 monthly totals."
          loading={calendarPending}
          value={calendar ? formatCount(calendar.stats.total) : "—"}
          hint={totalChangeInfo.text}
          hintClassName={totalChangeInfo.className}
          visual={
            calendar &&
            calendar.stats.total > 0 &&
            monthlySparkItems.length > 0 ? (
              <MiniSparkBars items={monthlySparkItems} />
            ) : null
          }
        />
        <StatCard
          icon={<Flame />}
          label={isPastYear ? `Streak at end of ${year}` : "Current streak"}
          tooltip="Consecutive active days ending on the end of the selected range (or yesterday if today has no activity yet)."
          loading={calendarPending}
          value={calendar ? `${calendar.stats.currentStreak}d` : "—"}
          hint={
            calendar && calendar.stats.longestStreak > 0
              ? `${Math.min(100, Math.round((calendar.stats.currentStreak / calendar.stats.longestStreak) * 100))}% of best`
              : "Consecutive days"
          }
          visual={
            calendar ? (
              <div className="w-12 sm:w-16">
                <div className="h-2 overflow-hidden rounded-full bg-heat-0">
                  <div
                    className="h-full rounded-full bg-heat-4"
                    style={{
                      width: `${
                        calendar.stats.longestStreak > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (calendar.stats.currentStreak /
                                  calendar.stats.longestStreak) *
                                  100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : null
          }
        />
        <StatCard
          icon={<Award />}
          label="Longest streak"
          tooltip="Longest uninterrupted streak of active contribution days in the selected range."
          loading={calendarPending}
          value={calendar ? `${calendar.stats.longestStreak}d` : "—"}
          hint={streakRangeLabel ?? "No active streak"}
        />
        <StatCard
          icon={<Trophy />}
          label="Best day"
          tooltip="Single day with the highest contribution volume in the selected range. Sparkline shows the 7 days around the best day."
          loading={calendarPending}
          value={
            calendar
              ? calendar.stats.bestDay
                ? formatCount(calendar.stats.bestDay.count)
                : "0"
              : "—"
          }
          hint={
            calendar?.stats.bestDay
              ? `Peak ${format(parseISO(calendar.stats.bestDay.date), "d MMM")}`
              : "No active days"
          }
          visual={
            calendar?.stats.bestDay ? (
              <BestDayMiniSpark
                days={calendar.days}
                bestDate={calendar.stats.bestDay.date}
              />
            ) : null
          }
        />
      </section>

      {/* 4. Year map */}
      <section
        data-section="year-map"
        className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6"
      >
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:mb-4">
          <h2 className="font-display text-lg">Year map</h2>
        </div>
        {calendarPending ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : calendar ? (
          <Heatmap
            days={calendar.days}
            selectedDate={selectedDate}
            onSelect={pickDate}
            view={viewMode}
            onViewChange={pickView}
          />
        ) : calendarError ? (
          <div className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl bg-secondary/35 px-4 text-center">
            <p className="text-xs text-muted-foreground">
              {calendarError.error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void calendarQuery.refetch()}
            >
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No calendar yet.</p>
        )}
      </section>

      {/* 5. Selected day detail + Last 14 days */}
      <section
        data-section="selected-day-detail"
        className="flex flex-col justify-between rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          const t = e.changedTouches[0];
          if (!start || !t || !calendar) return;
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0 && canStepNext) {
              pickDate(shiftDate(calendar.days, selectedDate, 1));
            } else if (dx > 0 && canStepPrev) {
              pickDate(shiftDate(calendar.days, selectedDate, -1));
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {format(selected, "d MMM yyyy")}
              </h2>
              {selectedDate === today ? (
                <Badge variant="accent" className="text-[11px]">
                  Today
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {format(selected, "EEEE")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {selectedDate !== defaultSelectedDate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => pickDate(defaultSelectedDate)}
                title={
                  isPastYear
                    ? `Jump back to end of ${year}`
                    : "Jump back to today"
                }
                className="px-2 sm:px-3"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">
                  {isPastYear ? `End of ${year}` : "Today"}
                </span>
              </Button>
            ) : null}
            <div className="inline-flex items-center rounded-md shadow-[var(--shadow-border)]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canStepPrev}
                aria-label="Previous day"
                onClick={() => {
                  if (!calendar) return;
                  pickDate(shiftDate(calendar.days, selectedDate, -1));
                }}
                className="rounded-r-none px-2"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="h-5 w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canStepNext}
                aria-label="Next day"
                onClick={() => {
                  if (!calendar) return;
                  pickDate(shiftDate(calendar.days, selectedDate, 1));
                }}
                className="rounded-l-none px-2"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Popover
              open={calendarPopoverOpen}
              onOpenChange={setCalendarPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 px-2.5 sm:gap-2 sm:px-3"
                  aria-label="Pick day"
                >
                  <CalendarDays />
                  <span className="hidden sm:inline">Pick day</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  key={selectedDate.slice(0, 7)}
                  mode="single"
                  selected={selected}
                  onSelect={(day) => {
                    if (!day) return;
                    pickDate(format(day, "yyyy-MM-dd"));
                    setCalendarPopoverOpen(false);
                  }}
                  disabled={{ after: parseISO(today) }}
                  defaultMonth={selected}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {calendarPending || (commitsQuery.isLoading && !commits) ? (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-3 sm:gap-3">
            <Skeleton className="h-24 w-full rounded-xl sm:h-28" />
            <Skeleton className="h-24 w-full rounded-xl sm:h-28" />
            <Skeleton className="h-24 w-full rounded-xl sm:h-28" />
          </div>
        ) : (
          (() => {
            const eff =
              commits && calendar && calendar.stats.total === 0
                ? {
                    ...commits,
                    total: 0,
                    publicTotal: 0,
                    privateTotal: 0,
                    mergedTotal: 0,
                    mergedPublicTotal: 0,
                    mergedPrivateTotal: 0,
                    openedPrsTotal: 0,
                  }
                : commits;
            const fallbackSplitError =
              commitsError?.error ??
              (!eff && calendarError
                ? "Commit & PR split unavailable while rate-limited"
                : undefined);
            return (
              <CountPair
                commitsLabel={eff ? formatCount(eff.total) : "—"}
                commitsHint={
                  eff && eff.privateTotal > 0
                    ? `${formatCount(eff.publicTotal)} pub · ${formatCount(eff.privateTotal)} priv`
                    : `${formatCount(eff?.publicTotal ?? 0)} public`
                }
                commitsError={fallbackSplitError}
                publicCommits={eff?.publicTotal ?? 0}
                privateCommits={eff?.privateTotal ?? 0}
                contribLabel={selectedDay ? formatCount(selectedDay.count) : "—"}
                contribCount={selectedDay?.count ?? 0}
                contribLevel={selectedDay?.level ?? 0}
                bestDayCount={calendar?.stats.bestDay?.count ?? 0}
                mergedLabel={eff ? formatCount(eff.mergedTotal) : "—"}
                mergedHint={
                  eff && (eff.mergedPrivateTotal ?? 0) > 0
                    ? `${formatCount(eff.mergedPublicTotal ?? 0)} pub · ${formatCount(eff.mergedPrivateTotal ?? 0)} priv`
                    : `${formatCount(eff?.mergedPublicTotal ?? eff?.mergedTotal ?? 0)} public`
                }
                mergedError={eff?.mergedError ?? fallbackSplitError}
                mergedCount={eff?.mergedTotal ?? 0}
                publicMerged={eff?.mergedPublicTotal ?? eff?.mergedTotal ?? 0}
                privateMerged={eff?.mergedPrivateTotal ?? 0}
                openedPrsCount={eff?.openedPrsTotal ?? 0}
                detailLoaded={Boolean(eff)}
              />
            );
          })()
        )}

        <div
          data-section="last-14-days"
          className="mt-5 border-t border-border pt-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base">Last 14 days</h3>
              <p className="text-xs text-muted-foreground">
                Click any bar to inspect that day
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums">
              {calendar ? (
                <span data-last-7-days="true">
                  Last 7 days: {formatCount(last7DaysTotal)}
                </span>
              ) : null}
              {calendar ? <span aria-hidden="true">·</span> : null}
              <span>Ending {format(selected, "EEE, d MMM")}</span>
            </div>
          </div>
          <WeekChart
            days={calendar?.days ?? []}
            selectedDate={selectedDate}
            onSelect={pickDate}
            loading={calendarPending}
            error={chartErrors.week ?? effectiveChartError}
            onRetry={() => void retryChart("week")}
          />
        </div>
      </section>

      {/* 6. Consistency & intensity + Monthly momentum / Weekday rhythm (2 columns -> 1 below 900px) */}
      <section
        data-section="analytics-pair"
        className="grid grid-cols-1 items-stretch gap-4 min-[900px]:grid-cols-2"
      >
        <div
          data-card="consistency-intensity"
          className="flex h-full flex-col justify-between gap-5 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">Consistency &amp; intensity</h2>
          </div>
          {calendar && cadence ? (
            <div className="flex flex-1 flex-col justify-between gap-5">
              <ConsistencyRing
                activeRatio={cadence.activeRatio}
                activeDays={cadence.activeDays}
                totalDays={cadence.totalDays}
                avgOnActive={cadence.avgOnActive}
                avgPerDay={cadence.avgPerDay}
                days={calendar.days}
              />
              <IntensityBreakdown days={calendar.days} />
              {quiet ? (
                <StreakBarcode
                  days={calendar.days}
                  quiet={quiet}
                  longestStreak={calendar.stats.longestStreak}
                  currentStreak={calendar.stats.currentStreak}
                  onSelectDate={pickDate}
                />
              ) : null}
            </div>
          ) : effectiveChartError ? (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-xl bg-secondary/35 px-4 text-center">
              <p className="text-xs text-muted-foreground">
                {effectiveChartError}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void calendarQuery.refetch()}
              >
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <Skeleton className="h-56 w-full rounded-xl" />
          )}
        </div>

        <div
          data-card="momentum-weekday"
          className="flex h-full flex-col justify-between gap-5 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6"
        >
          <MonthlyMomentumChart
            days={calendar?.days ?? []}
            today={today}
            loading={calendarPending}
            error={chartErrors.monthly ?? effectiveChartError}
            onRetry={() => void retryChart("monthly")}
            onSelectMonth={(iso) => {
              if (!calendar) return;
              const match = calendar.days.find(
                (d) => d.date.slice(0, 7) === iso.slice(0, 7),
              );
              if (match) pickDate(match.date);
            }}
          />
          <div className="border-t border-border pt-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg">Weekday rhythm</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total contributions by day of week (Mon–Sun)
                </p>
              </div>
              {!calendarPending &&
              !effectiveChartError &&
              !chartErrors.weekday &&
              busiest &&
              busiest.count > 0 ? (
                <span
                  data-weekday-peak-pill="true"
                  className="font-mono text-xs text-muted-foreground tabular-nums"
                >
                  Peak: {busiest.label} · {formatCount(busiest.count)}
                </span>
              ) : null}
            </div>
            <WeekdayChart
              rows={weekdayRows}
              loading={calendarPending}
              error={chartErrors.weekday ?? effectiveChartError}
              onRetry={() => void retryChart("weekday")}
            />
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 pb-3 text-xs text-muted-foreground sm:pt-4 sm:pb-4">
        <span className="truncate font-mono">
          <a
            href={`${SITE_ORIGIN}${canonicalUserPath}`}
            className="text-foreground/80 hover:underline"
          >
            git-cadence.grok.me{canonicalUserPath}
          </a>
        </span>
        <div className="flex items-center gap-4">
          <Link to="/board" className="text-foreground/80 hover:underline">
            Board
          </Link>
          <Link to="/compare" className="text-foreground/80 hover:underline">
            Compare
          </Link>
          <Link to="/docs" className="text-foreground/80 hover:underline">
            Docs
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function ProfilePageSkeleton({ username = "loading" }: { username?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const placeholder: CalendarLoaderData = {
    today,
    username,
    calendar: { error: "Loading", code: "unavailable" },
    commits: { error: "Loading", code: "unavailable" },
  };
  return (
    <CadenceApp
      key="profile-skeleton"
      initial={placeholder}
      routeUsername={username}
      forceSkeleton
    />
  );
}

export function ProfileNotFoundView({ username }: { username: string }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(username);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(username);
    setError(null);
    if (typeof document !== "undefined") {
      document.title = `User not found (@${username}) · Cadence`;
    }
  }, [username]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseGithubUsername(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const to = parsed.isReserved ? "/u/$username" : "/$username";
    void navigate({
      to,
      params: { username: parsed.username },
      search: {},
    });
  }

  return (
    <div
      data-charts-ready="true"
      data-section="profile-not-found-page"
      className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-6 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7"
    >
      <header>
        <AppHeader />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-6">
        <div
          data-section="profile-not-found"
          className="rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
        >
          <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
            <UserX className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            No GitHub user named &ldquo;{username}&rdquo;
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the spelling of the handle below, or pick one of the featured
            profiles to explore.
          </p>

          <form
            onSubmit={onSubmit}
            autoComplete="off"
            noValidate
            className="mt-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="not-found-username-input" className="sr-only">
                  GitHub username
                </label>
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-xs text-muted-foreground select-none">
                  github.com/
                </span>
                <Input
                  id="not-found-username-input"
                  name="not-found-github-handle"
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="username"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={error ? "true" : "false"}
                  className="h-10 pr-8 pl-[6.3rem] font-mono text-sm"
                />
                {draft ? (
                  <button
                    type="button"
                    aria-label="Clear username"
                    onClick={() => {
                      setDraft("");
                      setError(null);
                    }}
                    className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button type="submit" className="h-10 shrink-0 px-4">
                <span>View profile</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-xs font-medium text-rose-400">
                {error}
              </p>
            ) : null}
          </form>

          <div className="mt-6 border-t border-border/60 pt-4">
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">
              Featured profiles
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {FEATURED_PROFILES.map((item) => (
                <Link
                  key={item.login}
                  to={profileRoute(item.login)}
                  params={{ username: item.login }}
                  className="inline-flex items-center gap-2 rounded-xl bg-secondary/75 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
                >
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="size-4 rounded-full"
                  />
                  <span>@{item.login}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 pb-3 text-xs text-muted-foreground sm:pt-4 sm:pb-4">
        <Link to="/" className="font-mono text-foreground/80 hover:underline">
          git-cadence.grok.me
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/board" className="text-foreground/80 hover:underline">
            Board
          </Link>
          <Link to="/compare" className="text-foreground/80 hover:underline">
            Compare
          </Link>
          <Link to="/docs" className="text-foreground/80 hover:underline">
            Docs
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function ProfileOrganizationView({
  username,
  message,
}: {
  username: string;
  message?: string;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `Organization (@${username}) · Cadence`;
    }
  }, [username]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseGithubUsername(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const to = parsed.isReserved ? "/u/$username" : "/$username";
    void navigate({
      to,
      params: { username: parsed.username },
      search: {},
    });
  }

  return (
    <div
      data-charts-ready="true"
      data-section="profile-organization-page"
      className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-6 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7"
    >
      <header>
        <AppHeader />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-6">
        <div
          data-section="profile-organization"
          className="rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
        >
          <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
            <Building2 className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            @{username} is a GitHub organization
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {message ??
              "Contribution graphs are only available for individual GitHub user accounts, not organizations. Enter a personal GitHub username below to view their shipping cadence."}
          </p>

          <form
            onSubmit={onSubmit}
            autoComplete="off"
            noValidate
            className="mt-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="org-username-input" className="sr-only">
                  GitHub username
                </label>
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-xs text-muted-foreground select-none">
                  github.com/
                </span>
                <Input
                  id="org-username-input"
                  name="org-github-handle"
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="username"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={error ? "true" : "false"}
                  className="h-10 pr-8 pl-[6.3rem] font-mono text-sm"
                />
                {draft ? (
                  <button
                    type="button"
                    aria-label="Clear username"
                    onClick={() => {
                      setDraft("");
                      setError(null);
                    }}
                    className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button type="submit" className="h-10 shrink-0 px-4">
                <span>Search user</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-xs font-medium text-rose-400">
                {error}
              </p>
            ) : null}
          </form>

          <div className="mt-6 border-t border-border/60 pt-4">
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">
              Search a featured user instead
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {FEATURED_PROFILES.map((item) => (
                <Link
                  key={item.login}
                  to={profileRoute(item.login)}
                  params={{ username: item.login }}
                  className="inline-flex items-center gap-2 rounded-xl bg-secondary/75 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
                >
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="size-4 rounded-full"
                  />
                  <span>@{item.login}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 pb-3 text-xs text-muted-foreground sm:pt-4 sm:pb-4">
        <Link to="/" className="font-mono text-foreground/80 hover:underline">
          git-cadence.grok.me
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/board" className="text-foreground/80 hover:underline">
            Board
          </Link>
          <Link to="/compare" className="text-foreground/80 hover:underline">
            Compare
          </Link>
          <Link to="/docs" className="text-foreground/80 hover:underline">
            Docs
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ProfileApiErrorView({
  username,
  error,
  isRetrying,
  onRetry,
}: {
  username: string;
  error: string;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      data-charts-ready="true"
      data-section="profile-api-error-page"
      className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-6 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7"
    >
      <header>
        <AppHeader activeUsername={username} />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-6">
        <div
          data-section="profile-api-error"
          className="rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
        >
          <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Could not load @{username} right now
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              disabled={isRetrying}
              onClick={onRetry}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" />
              {isRetrying ? "Retrying…" : "Retry"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to search</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 pb-3 text-xs text-muted-foreground sm:pt-4 sm:pb-4">
        <Link to="/" className="font-mono text-foreground/80 hover:underline">
          git-cadence.grok.me
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/board" className="text-foreground/80 hover:underline">
            Board
          </Link>
          <Link to="/compare" className="text-foreground/80 hover:underline">
            Compare
          </Link>
          <Link to="/docs" className="text-foreground/80 hover:underline">
            Docs
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ScoreAndArchetypePopover({
  score,
  archetype,
}: {
  score: ScoreBreakdown;
  archetype: { id: BuilderArchetypeId; label: string; shortLabel: string };
}) {
  const tier = classifyTier(score.total);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Cadence Score ${score.total} (${tier.label}) · Archetype: ${archetype.label}. Click for score breakdown and tier thresholds.`}
          className="inline-flex items-center gap-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums transition-colors hover:opacity-90",
              tier.tone,
            )}
          >
            <Trophy className="size-3" />
            <span className="font-semibold">{score.total}</span>
            <span>· {tier.label}</span>
          </span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            {archetype.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 p-4 text-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <p className="font-semibold text-foreground">
              Cadence Score: {score.total} / 100 ({tier.label})
            </p>
            <p className="mt-0.5 text-muted-foreground">
              4-pillar composite index of shipping rhythm
            </p>
          </div>
          <Link
            to="/board"
            className="font-mono text-xs text-accent hover:underline"
          >
            Leaderboard →
          </Link>
        </div>

        <div className="space-y-1.5 font-mono tabular-nums">
          <div className="flex items-center justify-between">
            <span className="font-sans text-muted-foreground">
              Consistency (active days)
            </span>
            <span className="text-foreground">{score.consistencyPts} / 35</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-muted-foreground">
              Streak (current + best run)
            </span>
            <span className="text-foreground">{score.streakPts} / 25</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-muted-foreground">
              Output (log-scaled volume)
            </span>
            <span className="text-foreground">{score.outputPts} / 25</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-muted-foreground">
              Rhythm (weekday balance)
            </span>
            <span className="text-foreground">{score.rhythmPts} / 15</span>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/60 p-2.5">
          <p className="font-semibold text-foreground">
            Archetype: {archetype.label}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {ARCHETYPE_DESCRIPTIONS[archetype.id]}
          </p>
        </div>

        <div className="space-y-1 border-t border-border pt-2.5">
          <p className="font-medium text-foreground">Tier thresholds</p>
          {TIER_THRESHOLDS.map((t) => (
            <div
              key={t.label}
              className="flex items-center justify-between gap-2 text-muted-foreground"
            >
              <span className="font-medium text-foreground">{t.label}</span>
              <span className="font-mono tabular-nums">{t.range}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BestDayMiniSpark({
  days,
  bestDate,
}: {
  days: DayCount[];
  bestDate: string;
}) {
  const idx = days.findIndex((d) => d.date === bestDate);
  if (idx === -1) return null;
  const start = Math.max(0, Math.min(idx - 3, Math.max(0, days.length - 7)));
  const slice = days.slice(start, start + 7);
  return (
    <MiniSparkBars
      items={slice.map((d) => ({
        value: d.count,
        label: `${format(parseISO(d.date), "EEE, d MMM yyyy")}: ${formatCount(d.count)} ${d.count === 1 ? "contribution" : "contributions"}${d.date === bestDate ? " (best day)" : ""}`,
        highlighted: d.date === bestDate,
      }))}
    />
  );
}

function StatCard({
  icon,
  label,
  tooltip,
  value,
  hint,
  hintClassName,
  visual,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  tooltip?: string;
  value: string;
  hint: string;
  hintClassName?: string;
  visual?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-accent [&_svg]:size-4">{icon}</span>
          <span className="truncate text-xs font-medium">{label}</span>
        </div>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </div>
      <div className="mt-3">
        {loading ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <Skeleton className="h-7 w-24 sm:h-8 sm:w-28" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>
            <Skeleton className="mt-2 h-3.5 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <p className="min-w-0 truncate font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
                {value}
              </p>
              {visual ? <div className="shrink-0">{visual}</div> : null}
            </div>
            <p
              className={cn(
                "mt-1.5 truncate text-xs text-muted-foreground",
                hintClassName,
              )}
            >
              {hint}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
