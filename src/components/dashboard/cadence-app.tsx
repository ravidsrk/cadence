import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Award,
  CalendarDays,
  Check,
  Flame,
  GitCommitHorizontal,
  Link2,
  Search,
  Share2,
  Trophy,
} from "lucide-react";
import { getCalendar, getDayCommits } from "@/lib/github/api";
import {
  busiestWeekday,
  consistency,
  hourHistogram,
  profilePermalink,
  repoMix,
  shareText,
  weekdayTotals,
} from "@/lib/github/insights";
import { cadenceSearchFromState } from "@/lib/github/search";
import {
  isGithubFnError,
  type CalendarLoaderData,
  type DayCommit,
  type DayCount,
} from "@/lib/github/types";
import { normalizeUsername } from "@/lib/github/username";
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
import { Heatmap } from "./heatmap";
import { HourStrip } from "./hour-strip";
import { WeekChart } from "./week-chart";
import { WeekdayChart } from "./weekday-chart";

const STORAGE_KEY = "cadence:username";
export const DEFAULT_USER = "ravidsrk";
const FEATURED = ["torvalds", "gaearon", "yyx990803", "sindresorhus"] as const;

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function currentYear() {
  return new Date().getFullYear();
}

export function CadenceApp({
  initial,
  routeUsername,
  dateFromUrl,
  yearFromUrl,
}: {
  initial: CalendarLoaderData;
  routeUsername?: string;
  dateFromUrl?: string;
  yearFromUrl?: number;
}) {
  const navigate = useNavigate();
  const today = initial.today;
  const [draft, setDraft] = useState(initial.username);
  const [username, setUsername] = useState(initial.username);
  const [selectedDate, setSelectedDate] = useState(
    dateFromUrl && dateFromUrl <= today ? dateFromUrl : today,
  );
  const [year, setYear] = useState<number | undefined>(yearFromUrl);
  const [inputError, setInputError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (routeUsername) {
      setDraft(initial.username);
      setUsername(initial.username);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDraft(stored);
        setUsername(stored);
      }
    } catch {
      // ignore private mode
    }
  }, [initial.username, routeUsername]);

  useEffect(() => {
    if (dateFromUrl) setSelectedDate(dateFromUrl);
  }, [dateFromUrl]);

  useEffect(() => {
    setYear(yearFromUrl);
  }, [yearFromUrl]);

  const seededCalendar =
    initial.calendar &&
    !isGithubFnError(initial.calendar) &&
    username === initial.username &&
    year === yearFromUrl
      ? initial.calendar
      : undefined;

  const calendarQuery = useQuery({
    queryKey: ["calendar", username, year, today],
    queryFn: () => getCalendar({ data: { username, year, today } }),
    enabled: Boolean(username),
    staleTime: 60_000,
    initialData: seededCalendar,
  });

  const calendar =
    calendarQuery.data && !isGithubFnError(calendarQuery.data)
      ? calendarQuery.data
      : null;
  const calendarError =
    calendarQuery.data && isGithubFnError(calendarQuery.data)
      ? calendarQuery.data
      : calendarQuery.error
        ? { error: "Could not load the calendar.", code: "unavailable" as const }
        : null;
  const calendarPending = calendarQuery.isPending && !calendar;

  const commitsQuery = useQuery({
    queryKey: ["commits", username, selectedDate],
    queryFn: () => getDayCommits({ data: { username, date: selectedDate } }),
    enabled: Boolean(username) && Boolean(selectedDate) && !calendarError,
    staleTime: 60_000,
    initialData:
      username === initial.username &&
      selectedDate === (dateFromUrl ?? initial.today) &&
      initial.commits &&
      !isGithubFnError(initial.commits)
        ? initial.commits
        : undefined,
  });

  const commits =
    commitsQuery.data && !isGithubFnError(commitsQuery.data)
      ? commitsQuery.data
      : null;
  const commitsError =
    commitsQuery.data && isGithubFnError(commitsQuery.data)
      ? commitsQuery.data
      : null;

  const selectedDay: DayCount | undefined = calendar?.days.find(
    (d) => d.date === selectedDate,
  );
  const shareLogin = calendar?.profile.login ?? username;
  const rangeLabel = year ? String(year) : "last 12 months";

  function persistUsername(next: string) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function goProfile(next: string, nextYear?: number, nextDate?: string) {
    persistUsername(next);
    navigate({
      to: "/u/$username",
      params: { username: next },
      search: cadenceSearchFromState({
        today,
        selectedDate: nextDate ?? today,
        year: nextYear,
      }),
    });
  }

  function syncUrl(nextDate: string, nextYear: number | undefined) {
    if (!routeUsername) return;
    navigate({
      to: "/u/$username",
      params: { username: routeUsername },
      search: cadenceSearchFromState({
        today,
        selectedDate: nextDate,
        year: nextYear,
      }),
      replace: true,
    });
  }

  function submitUsername(event: FormEvent) {
    event.preventDefault();
    const next = normalizeUsername(draft);
    if (!next) {
      setInputError("Enter a GitHub username or profile URL.");
      return;
    }
    setInputError(null);
    setUsername(next);
    setDraft(next);
    setSelectedDate(today);
    setYear(undefined);
    persistUsername(next);
    goProfile(next);
  }

  function pickDate(iso: string) {
    setSelectedDate(iso);
    if (year && Number(iso.slice(0, 4)) !== year) {
      setYear(Number(iso.slice(0, 4)));
      syncUrl(iso, Number(iso.slice(0, 4)));
      return;
    }
    syncUrl(iso, year);
  }

  function pickYear(next: number | undefined) {
    setYear(next);
    if (next && Number(selectedDate.slice(0, 4)) !== next) {
      const clamped = next === currentYear() ? today : `${next}-12-31`;
      setSelectedDate(clamped);
      syncUrl(clamped, next);
      return;
    }
    syncUrl(selectedDate, next);
  }

  async function copyLink() {
    const url = profilePermalink({
      origin: window.location.origin,
      username: shareLogin,
      today,
      selectedDate,
      year,
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
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
    });
    const text = shareText({
      login: shareLogin,
      name: calendar?.profile.name,
      streak: calendar?.stats.currentStreak ?? 0,
      total: calendar?.stats.total ?? 0,
      rangeLabel,
      dayCount: commits?.total,
      dayLabel: format(parseISO(selectedDate), "d MMM yyyy"),
      url,
    });
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const years = [undefined, currentYear(), currentYear() - 1, currentYear() - 2];
  const selected = parseISO(selectedDate);
  const weekdayRows = calendar ? weekdayTotals(calendar.days) : [];
  const busiest = weekdayRows.length ? busiestWeekday(weekdayRows) : null;
  const cadence = calendar ? consistency(calendar.days) : null;
  const hours = commits ? hourHistogram(commits.commits.map((c) => c.authoredAt)) : [];
  const repos = commits ? repoMix(commits.commits) : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Public GitHub cadence
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              <Link to="/" className="hover:opacity-80">
                Cadence
              </Link>
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Look up any GitHub user. Click a day. Share the permalink.
            </p>
          </div>
          <form
            onSubmit={submitUsername}
            className="flex w-full max-w-md items-start gap-2"
          >
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="github-user">
                GitHub username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                  github.com/
                </span>
                <Input
                  id="github-user"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setInputError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="pl-[6.4rem] font-mono"
                  placeholder="username"
                />
              </div>
              {inputError ? (
                <p className="mt-1 text-xs text-muted-foreground">{inputError}</p>
              ) : null}
            </div>
            <Button type="submit" aria-label="Load user">
              <Search />
              Load
            </Button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check /> : <Link2 />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={shareOnX}>
            <Share2 />
            Share
          </Button>
          <p className="text-xs text-muted-foreground">
            Try{" "}
            {FEATURED.map((login, i) => (
              <span key={login}>
                <Link
                  to="/u/$username"
                  params={{ username: login }}
                  search={{}}
                  className="font-mono text-foreground hover:underline"
                >
                  {login}
                </Link>
                {i < FEATURED.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        </div>
      </header>

      {calendar?.profile ? (
        <div className="flex items-center gap-3">
          <img
            src={calendar.profile.avatarUrl}
            alt=""
            className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
          />
          <div className="min-w-0">
            <a
              href={calendar.profile.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              {calendar.profile.name ?? calendar.profile.login}
            </a>
            <p className="truncate text-sm text-muted-foreground">
              @{calendar.profile.login}
              {calendar.profile.bio ? ` · ${calendar.profile.bio}` : ""}
            </p>
          </div>
        </div>
      ) : calendarPending ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ) : null}

      {calendarError ? (
        <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          {calendarError.error}{" "}
          {calendarError.code === "not_found"
            ? "Try another public username."
            : null}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Selected day</p>
              <p className="mt-1 font-display text-2xl tracking-tight sm:text-3xl">
                {format(selected, "d MMMM yyyy")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(selected, "EEEE")}
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays />
                  Pick day
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  mode="single"
                  selected={selected}
                  onSelect={(day) => {
                    if (!day) return;
                    pickDate(format(day, "yyyy-MM-dd"));
                  }}
                  disabled={{ after: new Date() }}
                  defaultMonth={selected}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-8">
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Public commits
              </p>
              {commitsQuery.isPending && !commits ? (
                <Skeleton className="mt-2 h-14 w-28" />
              ) : (
                <p className="mt-1 font-mono text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-6xl">
                  {commits ? formatCount(commits.total) : "—"}
                </p>
              )}
              {commitsError ? (
                <p className="mt-2 max-w-xs text-xs text-muted-foreground">
                  {commitsError.error}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Authored on public default branches
                </p>
              )}
            </div>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                GitHub contributions
              </p>
              <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
                {selectedDay ? formatCount(selectedDay.count) : "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Commits, PRs, reviews, issues
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<GitCommitHorizontal />}
            label="Today"
            value={calendar ? formatCount(calendar.stats.today) : "—"}
            hint="contributions"
          />
          <StatCard
            icon={<Flame />}
            label="Streak"
            value={calendar ? String(calendar.stats.currentStreak) : "—"}
            hint="days in a row"
          />
          <StatCard
            icon={<Award />}
            label="Longest"
            value={calendar ? String(calendar.stats.longestStreak) : "—"}
            hint="best run in range"
          />
          <StatCard
            icon={<Trophy />}
            label="Best day"
            value={
              calendar?.stats.bestDay
                ? formatCount(calendar.stats.bestDay.count)
                : "—"
            }
            hint={
              calendar?.stats.bestDay
                ? format(parseISO(calendar.stats.bestDay.date), "d MMM")
                : "this range"
            }
          />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg">Year map</h2>
            <p className="text-sm text-muted-foreground">
              {calendar
                ? `${formatCount(calendar.stats.total)} contributions · ${calendar.stats.activeDays} active days`
                : "GitHub contribution calendar"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => {
              const label = y ? String(y) : "Last 12 months";
              const active = year === y;
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => pickYear(y)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
        {calendarPending ? (
          <Skeleton className="h-32 w-full" />
        ) : calendar ? (
          <Heatmap
            days={calendar.days}
            selectedDate={selectedDate}
            onSelect={pickDate}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No calendar yet.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-lg">Weekday rhythm</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {busiest
              ? `Most active on ${busiest.label}s · ${formatCount(busiest.count)} contributions`
              : "Where the volume lands across the week"}
          </p>
          {calendar ? (
            <WeekdayChart rows={weekdayRows} />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-lg">Consistency</h2>
          {cadence ? (
            <>
              <p className="mt-3 font-mono text-5xl leading-none font-medium tabular-nums">
                {Math.round(cadence.activeRatio * 100)}
                <span className="text-2xl text-muted-foreground">%</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                of days had at least one contribution
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    Shipping days
                  </dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {formatCount(cadence.activeDays)}
                    <span className="text-muted-foreground">
                      /{formatCount(cadence.totalDays)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    Typical day
                  </dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {cadence.avgOnActive.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    This week
                  </dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {calendar ? formatCount(calendar.stats.week) : "—"}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <Skeleton className="mt-4 h-32 w-full" />
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-lg">Last 14 days</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Contribution volume, ending at the selected day
          </p>
          {calendar ? (
            <WeekChart days={calendar.days} selectedDate={selectedDate} />
          ) : (
            <Skeleton className="h-44 w-full" />
          )}
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg">Commit log</h2>
            {commits ? (
              <Badge>
                {formatCount(commits.total)} public
                {commits.incomplete || commits.total > commits.commits.length
                  ? " · first 100"
                  : ""}
              </Badge>
            ) : null}
          </div>
          {commits && commits.commits.length > 0 ? (
            <div className="mb-4 space-y-3">
              <div>
                <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                  Authored, your local time
                </p>
                <HourStrip hours={hours} />
              </div>
              {repos.length > 1 ? (
                <ul className="flex flex-wrap gap-2">
                  {repos.slice(0, 6).map((row) => (
                    <li key={row.repo}>
                      <Badge>
                        {row.repo} · {row.count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <CommitList
            loading={commitsQuery.isPending && !commits}
            error={commitsError?.error}
            commits={commits?.commits ?? []}
          />
        </div>
      </section>

      <footer className="pb-4 text-xs leading-relaxed text-muted-foreground">
        Cadence reads the public GitHub contribution graph and public commit
        search. Private work can still fill heatmap squares without appearing in
        the log. Profiles live at{" "}
        <span className="font-mono text-foreground/80">/u/username</span> and
        are safe to share.
      </footer>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="[&_svg]:size-4">{icon}</span>
        <span className="text-xs tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-medium tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CommitList({
  loading,
  error,
  commits,
}: {
  loading: boolean;
  error?: string;
  commits: DayCommit[];
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (commits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No public commits authored on this day. Private repos and other
        contribution types still count in the heatmap.
      </p>
    );
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {commits.map((commit) => (
        <li key={commit.sha + commit.htmlUrl}>
          <a
            href={commit.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "block rounded-xl bg-secondary/60 p-3 shadow-[var(--shadow-border)]",
              "transition-[background-color] duration-150 ease-out hover:bg-secondary",
            )}
          >
            <p className="text-sm leading-snug text-pretty">{commit.message}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {commit.repo} · {commit.sha} ·{" "}
              {format(parseISO(commit.authoredAt), "HH:mm")}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
