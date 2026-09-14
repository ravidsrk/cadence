import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { busiestWeekday, consistency, weekdayTotals } from "@/lib/github/insights";
import { quietStats } from "@/lib/github/gaps";
import { isGithubFnError } from "@/lib/github/types";
import type { RecapLoaderData } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import { ExportMenu } from "./export-menu";
import { Heatmap } from "./heatmap";
import { QuietPanel } from "./quiet-panel";
import { WeekdayChart } from "./weekday-chart";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export function RecapView({ data }: { data: RecapLoaderData }) {
  const calendar = isGithubFnError(data.calendar) ? null : data.calendar;
  const languages = isGithubFnError(data.languages) ? [] : data.languages.items;
  const split = isGithubFnError(data.split) ? null : data.split;
  const languageError = isGithubFnError(data.languages)
    ? data.languages.error
    : null;
  const splitError = isGithubFnError(data.split) ? data.split.error : null;
  const weekdayRows = calendar ? weekdayTotals(calendar.days) : [];
  const busiest = weekdayRows.length ? busiestWeekday(weekdayRows) : null;
  const cadence = calendar ? consistency(calendar.days) : null;
  const quiet = calendar ? quietStats(calendar.days, data.today) : null;
  const login = calendar?.profile.login ?? data.username;
  const maxLang = languages[0]?.repos ?? 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Year recap
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {calendar?.profile.name || login} · {data.year}
          </h1>
          <p className="text-sm text-muted-foreground">
            Public GitHub shipping year. Safe to share.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {calendar ? <ExportMenu calendar={calendar} year={data.year} /> : null}
          <Link
            to="/u/$username"
            params={{ username: login }}
            search={{ y: data.year }}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Day view
          </Link>
          <Link
            to="/compare"
            search={{ a: login }}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Compare
          </Link>
          <Link
            to="/docs"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Docs
          </Link>
        </nav>
      </header>

      {isGithubFnError(data.calendar) ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          {data.calendar.error}
        </p>
      ) : null}

      {calendar ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RecapStat
              label="Contributions"
              value={formatCount(calendar.stats.total)}
            />
            <RecapStat
              label="Longest streak"
              value={`${calendar.stats.longestStreak}d`}
            />
            <RecapStat
              label="Active days"
              value={formatCount(calendar.stats.activeDays)}
            />
            <RecapStat
              label="Best day"
              value={
                calendar.stats.bestDay
                  ? `${formatCount(calendar.stats.bestDay.count)} · ${format(parseISO(calendar.stats.bestDay.date), "d MMM")}`
                  : "—"
              }
            />
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
            <h2 className="font-display text-lg">{data.year} map</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {formatCount(calendar.stats.total)} contributions ·{" "}
              {calendar.stats.activeDays} active days
            </p>
            <Heatmap days={calendar.days} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
              <h2 className="font-display text-lg">Weekday rhythm</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                {busiest
                  ? `Most active on ${busiest.label}s · ${formatCount(busiest.count)}`
                  : "Where the volume landed"}
              </p>
              <WeekdayChart rows={weekdayRows} />
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
                  {quiet ? <QuietPanel quiet={quiet} /> : null}
                </>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
              <h2 className="font-display text-lg">Public repos</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Primary language on the 30 most recently pushed public repos
                this user owns. Not commit volume.
              </p>
              {languageError ? (
                <p className="text-sm text-muted-foreground">{languageError}</p>
              ) : languages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No public primary languages.
                </p>
              ) : (
                <ul className="space-y-2">
                  {languages.slice(0, 8).map((row) => (
                    <li key={row.language}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span>{row.language}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {row.repos}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-heat-3"
                          style={{ width: `${(row.repos / maxLang) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
              <h2 className="font-display text-lg">Public search totals</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                GitHub search counts for {data.year}. Incomplete when GitHub
                caps the query.
              </p>
              {splitError ? (
                <p className="text-sm text-muted-foreground">{splitError}</p>
              ) : split ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Public commits
                    </p>
                    <p className="mt-1 font-mono text-4xl tabular-nums">
                      {formatCount(split.commits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Pull requests
                    </p>
                    <p className="mt-1 font-mono text-4xl tabular-nums">
                      {formatCount(split.pullRequests)}
                    </p>
                  </div>
                </div>
              ) : null}
              {quiet?.busiestMonth ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  Busiest month {quiet.busiestMonth.label}:{" "}
                  {formatCount(quiet.busiestMonth.total)} contributions.
                </p>
              ) : null}
              <p className="mt-4 font-mono text-xs text-muted-foreground break-all">
                {SITE_ORIGIN}/u/{login}/{data.year}
              </p>
            </div>
          </section>
        </>
      ) : null}

      <footer className="pb-4 text-xs text-muted-foreground">
        Recap uses the public contribution graph plus public search and public
        repos.{" "}
        <Link to="/docs" className="text-foreground/80 hover:underline">
          How Cadence counts
        </Link>
        .
      </footer>
    </div>
  );
}

function RecapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
    </div>
  );
}
