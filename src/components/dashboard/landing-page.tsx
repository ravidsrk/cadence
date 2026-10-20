import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Clock,
  Flame,
  GitCommitHorizontal,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { heatmapGrid } from "@/lib/github/layout";
import {
  buildSamplePreviewCalendar,
  clearRecentProfiles,
  FEATURED_PROFILES,
  LANDING_DRAFT_SESSION_KEY,
  readCachedProfileSummary,
  readRecentProfiles,
  removeRecentProfile,
  type CachedProfileSummary,
} from "@/lib/github/recent";
import { INTENSITY_THRESHOLDS } from "@/lib/github/stats";
import {
  isReservedRoute,
  parseGithubUsername,
  profilePath,
} from "@/lib/github/username";
import { SITE_ORIGIN } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppHeader } from "./site-nav";

const HEAT_BG_CLASSES: Record<number, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
  5: "bg-heat-5",
};

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

let clientHydrated = false;

export function LandingPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState(() => {
    if (!clientHydrated || typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem(LANDING_DRAFT_SESSION_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [recentProfiles, setRecentProfiles] = useState<string[]>(() => {
    if (!clientHydrated || typeof window === "undefined") return [];
    return readRecentProfiles();
  });
  const [cachedSummaries, setCachedSummaries] = useState<
    Record<string, CachedProfileSummary>
  >({});

  // Restore last typed input on mount (so browser Back preserves input) + load recent & cached summaries
  useEffect(() => {
    clientHydrated = true;
    try {
      const savedDraft = window.sessionStorage.getItem(
        LANDING_DRAFT_SESSION_KEY,
      );
      if (savedDraft) {
        setDraft(savedDraft);
      }
    } catch {
      // ignore sessionStorage errors
    }

    setRecentProfiles(readRecentProfiles());

    const map: Record<string, CachedProfileSummary> = {};
    for (const f of FEATURED_PROFILES) {
      const local = readCachedProfileSummary(f.login);
      if (local) {
        map[f.login.toLowerCase()] = local;
      }
    }
    setCachedSummaries(map);

    // Desktop-only autofocus (avoid mobile virtual keyboard popping up on 375px)
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px) and (pointer: fine)").matches
    ) {
      inputRef.current?.focus();
    }
  }, []);

  // Global `/` and `⌘K` shortcut to focus the hero username input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateDraft = (next: string) => {
    setDraft(next);
    if (error) setError(null);
    try {
      window.sessionStorage.setItem(LANDING_DRAFT_SESSION_KEY, next);
    } catch {
      // ignore
    }
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isNavigating) return;

    const parsed = parseGithubUsername(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setIsNavigating(true);
    try {
      window.sessionStorage.setItem(LANDING_DRAFT_SESSION_KEY, draft);
    } catch {
      // ignore
    }

    const navPromise = parsed.isReserved
      ? navigate({
          to: "/u/$username",
          params: { username: parsed.username },
        })
      : navigate({
          to: "/$username",
          params: { username: parsed.username },
        });
    void navPromise.catch(() => {}).finally(() => {
      setIsNavigating(false);
    });
  }

  const sampleCalendar = useMemo(() => buildSamplePreviewCalendar(), []);
  const previewGrid = useMemo(
    () => heatmapGrid(sampleCalendar.days.slice(-182)),
    [sampleCalendar],
  );
  const torvaldsCached = cachedSummaries["torvalds"];
  const previewTotal = torvaldsCached?.total ?? sampleCalendar.stats.total;
  const previewStreak =
    torvaldsCached?.currentStreak ?? sampleCalendar.stats.currentStreak;
  const previewActive =
    torvaldsCached?.activeDays ?? sampleCalendar.stats.activeDays;

  return (
    <div
      data-page="landing"
      className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-8 overflow-x-hidden px-4 py-5 sm:gap-10 sm:px-6 sm:py-7"
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        {/* 1. Header */}
        <header>
          <AppHeader hideSearch />
        </header>

        {/* 2. Hero */}
        <section
          aria-labelledby="landing-hero-heading"
          className="mx-auto flex w-full max-w-2xl flex-col items-center pt-2 text-center sm:pt-6"
        >
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 font-mono text-xs text-accent shadow-[var(--shadow-border)]">
            <Sparkles className="size-3.5" />
            <span>GitHub contribution intelligence</span>
          </div>

          <h1
            id="landing-hero-heading"
            className="font-display text-3xl font-bold tracking-tight text-balance text-foreground sm:text-5xl"
          >
            See anyone&apos;s GitHub contribution rhythm
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            Inspect daily shipping streaks, 3D contribution skylines, intensity
            distributions, and pull request breakdowns for any public GitHub
            profile in one step.
          </p>

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            noValidate
            className="mt-6 w-full max-w-xl text-left sm:mt-7"
          >
            <label htmlFor="landing-username-input" className="sr-only">
              GitHub username
            </label>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
              <div className="relative min-w-0 flex-1">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-sm text-muted-foreground select-none"
                >
                  github.com/
                </span>
                <input
                  ref={inputRef}
                  id="landing-username-input"
                  name="github-username"
                  type="text"
                  value={draft}
                  onChange={(e) => updateDraft(e.target.value)}
                  disabled={isNavigating}
                  placeholder="torvalds"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  data-1p-ignore=""
                  data-lpignore="true"
                  data-form-type="other"
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={
                    error ? "landing-username-error" : "landing-username-hint"
                  }
                  className={cn(
                    "h-12 w-full rounded-xl bg-card pr-10 pl-[7.1rem] font-mono text-base text-foreground shadow-[var(--shadow-border)] transition-all placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60",
                    error && "ring-2 ring-rose-500/80 focus:ring-rose-500",
                  )}
                />
                {draft && !isNavigating ? (
                  <button
                    type="button"
                    aria-label="Clear username input"
                    onClick={() => {
                      updateDraft("");
                      inputRef.current?.focus();
                    }}
                    className="absolute inset-y-0 right-3 flex items-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <kbd
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-border/80 bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-block"
                  >
                    /
                  </kbd>
                )}
              </div>

              <Button
                type="submit"
                disabled={isNavigating}
                className="h-12 shrink-0 rounded-xl px-6 text-sm font-semibold sm:w-auto"
              >
                {isNavigating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Opening…</span>
                  </>
                ) : (
                  <>
                    <span>View profile</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>

            {error ? (
              <p
                id="landing-username-error"
                role="alert"
                data-testid="landing-input-error"
                className="mt-2 text-xs font-medium text-rose-400"
              >
                {error}
              </p>
            ) : (
              <p
                id="landing-username-hint"
                className="mt-2 text-center font-mono text-xs text-muted-foreground sm:text-left"
              >
                Paste a handle (<span className="text-foreground/80">@torvalds</span>) or full URL (<span className="text-foreground/80">github.com/torvalds</span>) · Press <kbd className="rounded bg-secondary px-1 py-0.5 text-[10px]">/</kbd> or <kbd className="rounded bg-secondary px-1 py-0.5 text-[10px]">⌘K</kbd> to focus
              </p>
            )}
          </form>
        </section>

        {/* 3. Featured profiles */}
        <section
          aria-labelledby="featured-profiles-heading"
          data-section="featured-profiles"
          className="mx-auto w-full max-w-4xl space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="featured-profiles-heading"
              className="font-display text-sm font-semibold text-muted-foreground"
            >
              Featured profiles
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              1-click instant lookup
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4 sm:gap-3">
            {FEATURED_PROFILES.map((item) => {
              const summary = cachedSummaries[item.login.toLowerCase()];
              const reserved = isReservedRoute(item.login);
              return (
                <Link
                  key={item.login}
                  to={reserved ? "/u/$username" : "/$username"}
                  params={{ username: item.login }}
                  preload="intent"
                  className="group flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] transition-all duration-150 hover:bg-secondary/45 hover:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <img
                    src={summary?.avatarUrl ?? item.avatarUrl}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/15"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-foreground group-hover:text-accent">
                      {summary?.name || item.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      @{item.login}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-accent tabular-nums">
                      {summary
                        ? `${formatCount(summary.total)} contribs · ${summary.currentStreak}d streak`
                        : item.role}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 4. Recent profiles (hidden when empty) */}
        {recentProfiles.length > 0 ? (
          <section
            aria-labelledby="recent-profiles-heading"
            data-section="recent-profiles"
            className="mx-auto w-full max-w-4xl space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-accent" />
                <h2
                  id="recent-profiles-heading"
                  className="font-display text-sm font-semibold text-muted-foreground"
                >
                  Recent profiles
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearRecentProfiles();
                  setRecentProfiles([]);
                }}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {recentProfiles.map((handle) => {
                const reserved = isReservedRoute(handle);
                return (
                  <div
                    key={handle.toLowerCase()}
                    data-recent-profile={handle}
                    className="inline-flex items-center rounded-xl bg-card shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/50"
                  >
                    <Link
                      to={reserved ? "/u/$username" : "/$username"}
                      params={{ username: handle }}
                      preload="intent"
                      className="inline-flex items-center gap-2 rounded-l-xl py-1.5 pr-2 pl-2.5 font-mono text-xs text-foreground hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      <img
                        src={`https://github.com/${encodeURIComponent(handle)}.png?size=48`}
                        alt=""
                        loading="lazy"
                        className="size-4 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
                      />
                      <span>@{handle}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove @${handle} from recent profiles`}
                      onClick={() => {
                        setRecentProfiles(removeRecentProfile(handle));
                      }}
                      className="rounded-r-xl px-2 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* 5. Static non-interactive preview card */}
        <section
          aria-labelledby="preview-section-heading"
          data-section="profile-preview"
          className="mx-auto w-full max-w-4xl space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                Example preview
              </span>
              <h2
                id="preview-section-heading"
                className="font-display text-sm font-semibold text-muted-foreground"
              >
                What a Cadence profile looks like
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Click to open @torvalds →
            </span>
          </div>

          <Link
            to="/$username"
            params={{ username: "torvalds" }}
            preload="intent"
            aria-label="Open example profile for Linus Torvalds (@torvalds)"
            className="group block rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] transition-all duration-150 hover:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:p-6"
          >
            {/* Preview profile header row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                <img
                  src="https://github.com/torvalds.png?size=96"
                  alt=""
                  loading="lazy"
                  className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-foreground/15"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-semibold text-foreground group-hover:text-accent">
                      Linus Torvalds
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      @torvalds
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Creator of Linux and Git · Sample 6-month cadence snapshot
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs font-medium text-accent group-hover:bg-accent group-hover:text-accent-foreground">
                <span>Inspect full profile</span>
                <ArrowRight className="size-3.5" />
              </span>
            </div>

            {/* 3 Stat cards */}
            <div className="pointer-events-none mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-xl bg-secondary/45 p-3.5 shadow-[var(--shadow-border)]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitCommitHorizontal className="size-3.5 text-accent" />
                  <span>Total contributions</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-foreground tabular-nums">
                  {formatCount(previewTotal)}
                </p>
                <p className="mt-1 text-xs font-medium text-accent">
                  +14% vs prior 12 months
                </p>
              </div>

              <div className="rounded-xl bg-secondary/45 p-3.5 shadow-[var(--shadow-border)]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="size-3.5 text-accent" />
                  <span>Current streak</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-foreground tabular-nums">
                  {previewStreak}d
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Active shipping cadence
                </p>
              </div>

              <div className="rounded-xl bg-secondary/45 p-3.5 shadow-[var(--shadow-border)]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Award className="size-3.5 text-accent" />
                  <span>Active days</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-foreground tabular-nums">
                  {formatCount(previewActive)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Consistent kernel merges
                </p>
              </div>
            </div>

            {/* Cropped static heatmap */}
            <div
              aria-hidden="true"
              className="pointer-events-none overflow-hidden rounded-xl bg-secondary/30 p-3 shadow-[var(--shadow-border)]"
            >
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/85">
                  Contribution rhythm (recent 26 weeks)
                </span>
                <div className="hidden items-center gap-1.5 sm:flex">
                  {INTENSITY_THRESHOLDS.map((b) => (
                    <span
                      key={b.level}
                      className="inline-flex items-center gap-1 font-mono text-[10px]"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-[2px]",
                          HEAT_BG_CLASSES[b.level],
                        )}
                      />
                      <span>{b.label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${previewGrid.weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {previewGrid.weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-rows-7 gap-[3px]">
                    {week.map((day, di) => (
                      <span
                        key={day?.date ?? `empty-${wi}-${di}`}
                        className={cn(
                          "aspect-square w-full rounded-[2px]",
                          day
                            ? (HEAT_BG_CLASSES[day.level] ?? "bg-heat-0")
                            : "bg-transparent",
                        )}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </section>
      </div>

      {/* 6. Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 pb-3 text-xs text-muted-foreground sm:pt-4 sm:pb-4">
        <span className="truncate font-mono">
          <a
            href={SITE_ORIGIN}
            className="text-foreground/80 hover:underline"
          >
            git-cadence.grok.me{profilePath("torvalds")}
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
