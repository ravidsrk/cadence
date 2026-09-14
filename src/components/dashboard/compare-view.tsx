import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { consistency } from "@/lib/github/insights";
import { quietStats } from "@/lib/github/gaps";
import { isGithubFnError, type CalendarPayload, type GithubFnError } from "@/lib/github/types";
import { normalizeUsername } from "@/lib/github/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heatmap } from "./heatmap";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export function CompareForm({
  leftDefault = "",
  rightDefault = "",
}: {
  leftDefault?: string;
  rightDefault?: string;
}) {
  const navigate = useNavigate();
  const [left, setLeft] = useState(leftDefault);
  const [right, setRight] = useState(rightDefault);
  const [error, setError] = useState<string | null>(null);

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
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder="first username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
        />
        <Input
          value={right}
          onChange={(e) => setRight(e.target.value)}
          placeholder="second username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
        />
      </div>
      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
      <Button type="submit" className="w-fit">
        Compare
      </Button>
    </form>
  );
}

export function CompareView({
  a,
  b,
  left,
  right,
}: {
  a: string;
  b: string;
  left: CalendarPayload | GithubFnError;
  right: CalendarPayload | GithubFnError;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Compare
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {a} vs {b}
          </h1>
          <p className="text-sm text-muted-foreground">
            Last 12 months of public contribution calendars.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/docs">Docs</Link>
          </Button>
        </div>
      </header>
      <CompareForm leftDefault={a} rightDefault={b} />
      <section className="grid gap-4 lg:grid-cols-2">
        <CompareColumn username={a} calendar={left} />
        <CompareColumn username={b} calendar={right} />
      </section>
    </div>
  );
}

function CompareColumn({
  username,
  calendar,
}: {
  username: string;
  calendar: CalendarPayload | GithubFnError;
}) {
  if (isGithubFnError(calendar)) {
    return (
      <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
        {calendar.error}
      </div>
    );
  }
  const cadence = consistency(calendar.days);
  const quiet = quietStats(calendar.days, calendar.range.to);
  return (
    <div className="overflow-hidden rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <img
          src={calendar.profile.avatarUrl}
          alt=""
          className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
        />
        <div className="min-w-0">
          <Link
            to="/u/$username"
            params={{ username: calendar.profile.login }}
            className="font-medium hover:underline"
          >
            {calendar.profile.name || calendar.profile.login}
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            @{calendar.profile.login}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Contributions" value={formatCount(calendar.stats.total)} />
        <Stat label="Streak" value={`${calendar.stats.currentStreak}d`} />
        <Stat label="Longest" value={`${calendar.stats.longestStreak}d`} />
        <Stat
          label="Consistency"
          value={`${Math.round(cadence.activeRatio * 100)}%`}
        />
        <Stat label="Active days" value={formatCount(calendar.stats.activeDays)} />
        <Stat
          label="Current pause"
          value={quiet.currentPause === 0 ? "0" : `${quiet.currentPause}d`}
        />
      </dl>
      <div className="mt-5">
        <Heatmap days={calendar.days} />
      </div>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to="/u/$username" params={{ username: calendar.profile.login }}>
          Open {username}
        </Link>
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono tabular-nums">{value}</dd>
    </div>
  );
}
