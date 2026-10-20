import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowUpRight,
  CalendarDays,
  Compass,
  Flame,
  GitFork,
  Info,
  Plus,
  Search,
  Sparkles,
  Star,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import {
  addBoard,
  discoverTrending,
  discoverTrendingRepos,
  getBoard,
  getBuilderPortfolio,
  refreshBoardIndex,
} from "@/lib/github/api";
import type { IndexerStatus } from "@/lib/github/indexer.server";
import {
  BOARD_MAX,
  boardSearchFromState,
  classifyTier,
  computeWindowStats,
  parseBoardSort,
  parseBoardWindow,
  sortBoard,
  type BoardEntry,
  type BoardSort,
  type BoardWindow,
  type BuilderArchetypeId,
  type ScoreBreakdown,
} from "@/lib/github/board";
import type {
  BuilderPortfolioResult,
  TrendingDeveloperItem,
  TrendingRepositoryItem,
} from "@/lib/github/treg.server";
import { profileRoute } from "@/lib/github/username";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppHeader } from "./site-nav";
import { Podium3DStage, Tilt3DCard } from "./skyline-3d";
import { MiniHeatStrip } from "./visual-metrics";
import { cn } from "@/lib/utils";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

const LANGUAGE_COHORTS: {
  id: string;
  label: string;
  shortLabel: string;
  seeds: string[];
}[] = [
  { id: "", label: "Global Open", shortLabel: "Global", seeds: [] },
  {
    id: "typescript",
    label: "TypeScript",
    shortLabel: "TypeScript",
    seeds: [
      "sindresorhus",
      "antfu",
      "shadcn",
      "rich-harris",
      "yyx990803",
      "gaearon",
      "tannerlinsley",
      "evanw",
      "rauchg",
      "ravidsrk",
    ],
  },
  {
    id: "python",
    label: "Python",
    shortLabel: "Python",
    seeds: ["tiangolo", "karpathy"],
  },
  {
    id: "rust",
    label: "Rust",
    shortLabel: "Rust",
    seeds: ["burntsushi", "dtolnay", "evanw", "mitchellh"],
  },
  {
    id: "go",
    label: "Go",
    shortLabel: "Go",
    seeds: ["mitchellh", "evanw", "torvalds"],
  },
];

const WINDOWS: { id: BoardWindow; label: string; sub: string }[] = [
  { id: "7d", label: "7D", sub: "Last 7 days" },
  { id: "30d", label: "30D", sub: "Last 30 days" },
  { id: "90d", label: "90D", sub: "Last 90 days" },
  { id: "12m", label: "12M", sub: "Full year" },
];

const SORTS: { id: BoardSort; label: string; shortLabel?: string }[] = [
  { id: "score", label: "Cadence Score", shortLabel: "Score" },
  { id: "momentum", label: "Momentum", shortLabel: "Momentum" },
  { id: "streak", label: "Streak" },
  { id: "consistency", label: "Consistency" },
  { id: "volume", label: "Volume" },
  { id: "peak", label: "Peak day", shortLabel: "Peak" },
  { id: "active", label: "Active days", shortLabel: "Active" },
];

const ARCHETYPE_META: Record<
  BuilderArchetypeId,
  { badge: string; tone: string }
> = {
  relentless: {
    badge: "Relentless",
    tone: "bg-heat-4/20 text-accent ring-1 ring-heat-4/40",
  },
  surging: {
    badge: "Surging",
    tone: "bg-heat-3/20 text-accent ring-1 ring-heat-3/40",
  },
  marathoner: {
    badge: "Marathon",
    tone: "bg-heat-2/35 text-foreground ring-1 ring-heat-2/50",
  },
  "high-output": {
    badge: "Heavy",
    tone: "bg-secondary text-foreground ring-1 ring-border",
  },
  "peak-striker": {
    badge: "Striker",
    tone: "bg-secondary text-muted-foreground ring-1 ring-border",
  },
  steady: {
    badge: "Steady",
    tone: "bg-secondary/70 text-muted-foreground ring-1 ring-border/60",
  },
};

export function BoardView({
  entries: initialEntries,
  max = BOARD_MAX,
  total = 0,
  hasMore: initialHasMore = false,
  indexer = null,
  sort: sortFromUrl,
  window: windowFromUrl,
  date,
  today,
}: {
  entries: BoardEntry[];
  max?: number;
  total?: number;
  hasMore?: boolean;
  indexer?: IndexerStatus | null;
  sort?: BoardSort;
  window?: BoardWindow;
  date?: string;
  today: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshingIndex, setRefreshingIndex] = useState(false);
  useEffect(() => {
    setEntries(initialEntries);
    setHasMore(initialHasMore);
  }, [initialEntries, initialHasMore]);
  const navigate = useNavigate();
  const router = useRouter();
  const sort = date ? "day" : parseBoardSort(sortFromUrl);
  const activeWindow = parseBoardWindow(windowFromUrl);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [archetypeFilter, setArchetypeFilter] = useState<
    BuilderArchetypeId | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFormula, setShowFormula] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [trendingMode, setTrendingMode] = useState<
    "developers" | "repositories"
  >("developers");
  const [trendingLang, setTrendingLang] = useState("");
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingSource, setTrendingSource] = useState<string | null>(null);
  const [trendingItems, setTrendingItems] = useState<TrendingDeveloperItem[]>(
    [],
  );
  const [trendingRepos, setTrendingRepos] = useState<TrendingRepositoryItem[]>(
    [],
  );
  const [activeCohort, setActiveCohort] = useState("");
  const [cohortMembers, setCohortMembers] = useState<Record<string, string[]>>(
    {},
  );
  const [cohortSyncing, setCohortSyncing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<
    Record<string, BuilderPortfolioResult>
  >({});
  const [portfolioLoading, setPortfolioLoading] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<string[]>([]);
  const selected = date ? parseISO(date) : undefined;

  async function loadTrending(
    lang: string,
    syncToBoard = false,
    modeOverride?: "developers" | "repositories",
  ) {
    const mode = modeOverride ?? trendingMode;
    setTrendingLoading(true);
    setTrendingLang(lang);
    try {
      if (mode === "repositories") {
        const res = await discoverTrendingRepos({
          data: {
            language: lang || undefined,
            since: "daily",
            syncToBoard,
          },
        });
        setTrendingRepos(res.repositories);
        setTrendingSource(res.source);
        if (syncToBoard && res.addedCount > 0) {
          setMessage(
            `Synced ${res.addedCount} builders from trending repos to board.`,
          );
          await router.invalidate();
        }
      } else {
        const res = await discoverTrending({
          data: {
            language: lang || undefined,
            since: "daily",
            syncToBoard,
          },
        });
        setTrendingItems(res.developers);
        setTrendingSource(res.source);
        if (lang) {
          setCohortMembers((prev) => ({
            ...prev,
            [lang]: Array.from(
              new Set([
                ...(prev[lang] ?? []),
                ...res.developers.map((d) => d.username.toLowerCase()),
              ]),
            ),
          }));
        }
        if (syncToBoard && res.addedCount > 0) {
          setMessage(`Synced ${res.addedCount} trending builders to board.`);
          await router.invalidate();
        }
      }
    } catch {
      // ignore
    } finally {
      setTrendingLoading(false);
    }
  }

  async function selectLanguageCohort(cohortId: string) {
    setActiveCohort(cohortId);
    if (!cohortId) return;
    setCohortSyncing(true);
    try {
      const res = await discoverTrending({
        data: {
          language: cohortId,
          since: "daily",
          syncToBoard: true,
        },
      });
      setCohortMembers((prev) => ({
        ...prev,
        [cohortId]: Array.from(
          new Set([
            ...(prev[cohortId] ?? []),
            ...res.developers.map((d) => d.username.toLowerCase()),
          ]),
        ),
      }));
      if (res.addedCount > 0) {
        setMessage(
          `Seeded ${res.addedCount} trending ${cohortId} builders into the league.`,
        );
        await router.invalidate();
      }
    } catch {
      // ignore
    } finally {
      setCohortSyncing(false);
    }
  }

  async function toggleExpandUser(login: string) {
    const next = expandedUser === login ? null : login;
    setExpandedUser(next);
    if (next && !portfolios[next.toLowerCase()]) {
      setPortfolioLoading(next.toLowerCase());
      try {
        const res = await getBuilderPortfolio({ data: { username: next } });
        setPortfolios((prev) => ({ ...prev, [next.toLowerCase()]: res }));
      } catch {
        // ignore
      } finally {
        setPortfolioLoading(null);
      }
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await getBoard({
        data: {
          sort: date ? "score" : sort,
          window: activeWindow,
          offset: entries.length,
        },
      });
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.username.toLowerCase()));
        return [
          ...prev,
          ...page.entries.filter((e) => !seen.has(e.username.toLowerCase())),
        ];
      });
      setHasMore(page.hasMore);
    } catch {
      setMessage("Could not load more builders. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshIndex() {
    if (refreshingIndex) return;
    setRefreshingIndex(true);
    try {
      const res = await refreshBoardIndex();
      setMessage(
        res.processed.indexed > 0
          ? `Indexed ${res.processed.indexed} more builders from the discovery queue.`
          : "Discovery queue is drained — the scheduled indexer adds new builders every 3 hours.",
      );
      if (res.processed.indexed > 0) await router.invalidate();
    } catch {
      setMessage("Indexer refresh failed. Try again in a minute.");
    } finally {
      setRefreshingIndex(false);
    }
  }

  function toggleCompareUser(login: string) {
    setComparePair((prev) => {
      if (prev.includes(login)) {
        return prev.filter((u) => u !== login);
      }
      if (prev.length >= 2) {
        return [prev[1]!, login];
      }
      return [...prev, login];
    });
  }

  // Recompute entry stats dynamically for the selected time window (7d, 30d, 90d, 12m)
  const windowedEntries = useMemo(() => {
    return entries.map((entry) => {
      if (entry.error) return entry;
      const ws = computeWindowStats(entry, activeWindow, today);
      return {
        ...entry,
        total: ws.total,
        activeDays: ws.activeDays,
        consistency: ws.consistency,
        streak: ws.streak,
        longest: ws.longest,
        bestDay: ws.bestDay,
        score: ws.score,
        momentumDelta: ws.momentumDelta,
        archetype: ws.archetype,
      };
    });
  }, [entries, activeWindow, today]);

  const ranked = useMemo(
    () => sortBoard(windowedEntries, sort, date),
    [windowedEntries, sort, date],
  );

  const validEntries = useMemo(
    () => ranked.filter((r) => !r.error),
    [ranked],
  );

  // Archetype counts across valid entries
  const archetypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: validEntries.length };
    for (const r of validEntries) {
      counts[r.archetype.id] = (counts[r.archetype.id] ?? 0) + 1;
    }
    return counts;
  }, [validEntries]);

  // Filtered rows for the table (supports Language Cohort Leagues, Archetypes, and Search)
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cohortDef = LANGUAGE_COHORTS.find((c) => c.id === activeCohort);
    const allowedCohortSet =
      activeCohort && cohortDef
        ? new Set([
            ...cohortDef.seeds.map((s) => s.toLowerCase()),
            ...(cohortMembers[activeCohort] ?? []),
          ])
        : null;

    return ranked.filter((r) => {
      const login = (r.profile?.login ?? r.username).toLowerCase();
      if (allowedCohortSet && !allowedCohortSet.has(login)) {
        return false;
      }
      if (archetypeFilter !== "all" && !r.error) {
        if (r.archetype.id !== archetypeFilter) return false;
      }
      if (q) {
        const name = (r.profile?.name ?? "").toLowerCase();
        return login.includes(q) || name.includes(q);
      }
      return true;
    });
  }, [ranked, activeCohort, cohortMembers, archetypeFilter, searchQuery]);

  // Board-wide pulse metrics for the active window
  const boardPulse = useMemo(() => {
    if (validEntries.length === 0) {
      return {
        totalCommits: 0,
        avgScore: 0,
        activeStreaks: 0,
        topSurger: null as BoardEntry | null,
      };
    }
    const totalCommits = validEntries.reduce((s, r) => s + r.total, 0);
    const avgScore = Math.round(
      validEntries.reduce((s, r) => s + r.score.total, 0) /
        validEntries.length,
    );
    const activeStreaks = validEntries.filter((r) => r.streak > 0).length;
    let topSurger: BoardEntry | null = null;
    for (const r of validEntries) {
      if (
        r.momentumDelta !== null &&
        r.momentumDelta > 0 &&
        (!topSurger || (r.momentumDelta ?? 0) > (topSurger.momentumDelta ?? 0))
      ) {
        topSurger = r;
      }
    }
    return { totalCommits, avgScore, activeStreaks, topSurger };
  }, [validEntries]);

  function metricScore(row: BoardEntry): number {
    if (date) return row.byDate[date] ?? 0;
    if (sort === "score") return row.score.total;
    if (sort === "momentum") return Math.max(0, (row.momentumDelta ?? 0) + 100);
    if (sort === "peak") return row.bestDay?.count ?? 0;
    if (sort === "streak") return row.streak;
    if (sort === "volume") return row.total;
    if (sort === "active") return row.activeDays;
    if (sort === "consistency") return Math.round(row.consistency * 100);
    return row.score.total;
  }

  function metricPrimaryLabel(row: BoardEntry): {
    value: string;
    sub: string;
  } {
    if (date) {
      return {
        value: formatCount(row.byDate[date] ?? 0),
        sub: format(parseISO(date), "d MMM"),
      };
    }
    if (sort === "score") {
      return {
        value: `${row.score.total}`,
        sub: `Cadence pts · ${Math.round(row.consistency * 100)}% active`,
      };
    }
    if (sort === "momentum") {
      const m = row.momentumDelta;
      return {
        value: m !== null ? `${m >= 0 ? "+" : ""}${m}%` : "—",
        sub: `${formatCount(row.total)} in ${activeWindow}`,
      };
    }
    if (sort === "streak") {
      return { value: `${row.streak}d`, sub: `Best ${row.longest}d` };
    }
    if (sort === "volume") {
      return { value: formatCount(row.total), sub: `${row.activeDays}d active` };
    }
    if (sort === "active") {
      return {
        value: `${row.activeDays}d`,
        sub: `${Math.round(row.consistency * 100)}% consistency`,
      };
    }
    if (sort === "consistency") {
      return {
        value: `${Math.round(row.consistency * 100)}%`,
        sub: `${row.activeDays} active days`,
      };
    }
    return {
      value: row.bestDay ? formatCount(row.bestDay.count) : "—",
      sub: row.bestDay
        ? format(parseISO(row.bestDay.date), "d MMM yyyy")
        : "Peak day",
    };
  }

  const podium = validEntries.slice(0, 3);
  const leaderLogin = podium[0]?.profile?.login ?? podium[0]?.username;
  const maxScore = Math.max(1, ...validEntries.map((r) => metricScore(r)));
  const heatStripDays =
    activeWindow === "7d" ? 7 : activeWindow === "30d" ? 18 : 20;

  function go(next: {
    sort?: BoardSort;
    date?: string | null;
    window?: BoardWindow;
  }) {
    const nextSort = next.sort ?? (date ? "score" : sort);
    const nextDate = next.date === null ? undefined : (next.date ?? date);
    const nextWindow = next.window ?? activeWindow;
    void navigate({
      to: "/board",
      search: boardSearchFromState({
        sort: nextDate ? "day" : nextSort,
        date: nextDate,
        window: nextWindow,
      }),
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await addBoard({ data: { username: draft } });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setDraft("");
      setMessage(result.already ? "Already on the board." : "Added to board.");
      await router.invalidate();
    } catch {
      setMessage("Could not add that profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 overflow-x-hidden px-3.5 py-4 sm:gap-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3.5 sm:gap-5">
        <AppHeader subtitle="Shipping index" />

        {/* Hero Header + Add to Board + Window Pulse */}
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight sm:text-3xl">
                  Shipping leaderboard
                </h1>
                <span className="rounded-full bg-heat-2/35 px-2.5 py-0.5 font-mono text-xs font-medium text-accent tabular-nums">
                  {formatCount(total || validEntries.length)} builders indexed
                </span>
                <button
                  type="button"
                  onClick={() => void refreshIndex()}
                  disabled={refreshingIndex}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  <Sparkles className="size-3 text-accent" />
                  <span>{refreshingIndex ? "Indexing…" : "Index more"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFormula((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="size-3 text-accent" />
                  <span>How Score works</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showTrending;
                    setShowTrending(next);
                    if (next && trendingItems.length === 0) {
                      void loadTrending(trendingLang, false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25"
                >
                  <Compass className="size-3" />
                  <span>Discover Trending</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Ranked by sustained shipping rhythm, streak durability, output
                velocity, and anti-spike balance.
              </p>
            </div>

            <div className="w-full max-w-md">
              <form onSubmit={onSubmit} className="flex items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground select-none">
                    github.com/
                  </span>
                  <Input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setMessage(null);
                    }}
                    placeholder="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pl-[6.4rem] font-mono"
                  />
                </div>
                <Button type="submit" disabled={pending} className="shrink-0">
                  <Plus />
                  <span className="sm:hidden">{pending ? "…" : "Add"}</span>
                  <span className="hidden sm:inline">
                    {pending ? "Adding…" : "Add builder"}
                  </span>
                </Button>
              </form>
              {message ? (
                <p className="mt-1.5 text-xs text-accent">{message}</p>
              ) : null}
            </div>
          </div>

          {/* Board Pulse Strip — flat inline divider rhythm instead of nested cards */}
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3.5 sm:grid-cols-4 sm:divide-x sm:divide-border/60 sm:gap-0">
            <div className="sm:pr-4">
              <p className="text-xs font-medium text-muted-foreground">
                Window horizon
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
                {date
                  ? format(parseISO(date), "d MMM yyyy")
                  : WINDOWS.find((w) => w.id === activeWindow)?.sub}
              </p>
            </div>
            <div className="sm:px-4">
              <p className="text-xs font-medium text-muted-foreground">
                Board output ({activeWindow.toUpperCase()})
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-accent tabular-nums sm:text-base">
                {formatCount(boardPulse.totalCommits)}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  commits
                </span>
              </p>
            </div>
            <div className="sm:px-4">
              <p className="text-xs font-medium text-muted-foreground">
                Live streaks
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums sm:text-base">
                {boardPulse.activeStreaks}/{validEntries.length}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  shipping now
                </span>
              </p>
            </div>
            <div className="sm:pl-4">
              <p className="text-xs font-medium text-muted-foreground">
                Top velocity surge
              </p>
              {boardPulse.topSurger ? (
                <Link
                  to={profileRoute(
                    boardPulse.topSurger.profile?.login ??
                      boardPulse.topSurger.username,
                  )}
                  params={{
                    username:
                      boardPulse.topSurger.profile?.login ??
                      boardPulse.topSurger.username,
                  }}
                  className="mt-0.5 inline-flex items-center gap-1 font-mono text-sm font-semibold text-accent hover:underline sm:text-base"
                >
                  @{boardPulse.topSurger.profile?.login ??
                    boardPulse.topSurger.username}
                  <span className="text-xs tabular-nums">
                    (+{boardPulse.topSurger.momentumDelta}%)
                  </span>
                </Link>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Steady pace
                </p>
              )}
            </div>
          </div>

          {/* Expandable Cadence Score Formula Card */}
          {showFormula ? (
            <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2 pb-2.5">
                <p className="font-display text-sm font-semibold text-foreground">
                  Composite Cadence Score (0–100 pts)
                </p>
                <button
                  type="button"
                  onClick={() => setShowFormula(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-accent">
                      1. Consistency
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      35 pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share of active days inside the selected {activeWindow}{" "}
                    horizon.
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-heat-3">
                      2. Streak durability
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      25 pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Blends active daily streak (55%) with longest sustained run
                    (45%).
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-heat-2">
                      3. Log output
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      25 pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Log-scaled daily commit rate so scripts can&apos;t drown out
                    real code.
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">
                      4. Anti-spike rhythm
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      15 pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Penalizes single-day bulk dumps in favor of balanced daily
                    shipping.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Expandable Live Trending Builders & Repositories Discovery Drawer (treg + GitHub Trending) */}
          {showTrending ? (
            <div className="rounded-xl border border-accent/35 bg-secondary/40 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
                    <Compass className="size-3.5 text-accent" />
                    Live Discovery
                  </span>
                  <div className="inline-flex rounded-lg bg-card p-0.5 shadow-[var(--shadow-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setTrendingMode("developers");
                        if (trendingItems.length === 0) {
                          void loadTrending(trendingLang, false, "developers");
                        }
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        trendingMode === "developers"
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Trending Builders
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrendingMode("repositories");
                        if (trendingRepos.length === 0) {
                          void loadTrending(
                            trendingLang,
                            false,
                            "repositories",
                          );
                        }
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        trendingMode === "repositories"
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Trending Repos
                    </button>
                  </div>
                  {trendingSource ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
                      via {trendingSource}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "", label: "All" },
                    { id: "typescript", label: "TypeScript" },
                    { id: "python", label: "Python" },
                    { id: "rust", label: "Rust" },
                    { id: "go", label: "Go" },
                  ].map((lang) => (
                    <button
                      key={lang.id || "all"}
                      type="button"
                      disabled={trendingLoading}
                      onClick={() => {
                        setTrendingLang(lang.id);
                        void loadTrending(lang.id, false, trendingMode);
                      }}
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-xs font-medium transition-colors",
                        trendingLang === lang.id
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={trendingLoading}
                    onClick={() =>
                      void loadTrending(trendingLang, true, trendingMode)
                    }
                    className="rounded-lg bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/30 disabled:opacity-50"
                  >
                    {trendingLoading
                      ? "Syncing…"
                      : trendingMode === "repositories"
                        ? "+ Sync Repo Owners"
                        : "+ Sync Top 4 to Board"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrending(false)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {trendingMode === "developers" ? (
                trendingLoading && trendingItems.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Discovering active trending builders…
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {trendingItems.slice(0, 9).map((dev) => {
                      const alreadyOnBoard = entries.some(
                        (e) =>
                          e.username.toLowerCase() ===
                          dev.username.toLowerCase(),
                      );
                      return (
                        <div
                          key={dev.username}
                          className="flex items-center justify-between gap-2.5 rounded-lg bg-card p-2.5 shadow-[var(--shadow-border)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <img
                              src={
                                dev.avatarUrl ??
                                `https://github.com/${dev.username}.png?size=64`
                              }
                              alt=""
                              className="size-7 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs font-semibold text-foreground">
                                @{dev.username}
                              </p>
                              {dev.repoName ? (
                                <p className="truncate font-mono text-[10px] text-muted-foreground">
                                  {dev.repoName}
                                </p>
                              ) : (
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {dev.name}
                                </p>
                              )}
                            </div>
                          </div>
                          {alreadyOnBoard ? (
                            <Link
                              to={profileRoute(dev.username)}
                              params={{ username: dev.username }}
                              className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                            >
                              On Board →
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={async () => {
                                setPending(true);
                                try {
                                  await addBoard({
                                    data: { username: dev.username },
                                  });
                                  await router.invalidate();
                                  setMessage(
                                    `Added @${dev.username} to board.`,
                                  );
                                } catch (err) {
                                  setMessage(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not add builder",
                                  );
                                } finally {
                                  setPending(false);
                                }
                              }}
                              className="shrink-0 rounded-md bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : trendingLoading && trendingRepos.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Discovering fastest-rising GitHub repositories…
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {trendingRepos.slice(0, 9).map((repo) => {
                    const ownerOnBoard = entries.some(
                      (e) =>
                        e.username.toLowerCase() === repo.owner.toLowerCase(),
                    );
                    return (
                      <div
                        key={repo.fullName}
                        className="flex flex-col justify-between gap-2 rounded-lg bg-card p-2.5 shadow-[var(--shadow-border)]"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-mono text-xs font-semibold text-foreground hover:text-accent hover:underline"
                            >
                              {repo.fullName}
                            </a>
                            {repo.starsToday > 0 ? (
                              <span className="shrink-0 rounded-full bg-heat-4/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-accent tabular-nums">
                                +{formatCount(repo.starsToday)} ★ today
                              </span>
                            ) : null}
                          </div>
                          {repo.description ? (
                            <p className="line-clamp-2 text-[11px] text-muted-foreground">
                              {repo.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {repo.language ? (
                              <span className="rounded bg-secondary px-1.5 py-0.2 font-medium text-foreground">
                                {repo.language}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                              <Star className="size-2.5 text-accent" />
                              {formatCount(repo.stars)}
                            </span>
                            {repo.forks > 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                                <GitFork className="size-2.5" />
                                {formatCount(repo.forks)}
                              </span>
                            ) : null}
                          </div>

                          {ownerOnBoard ? (
                            <Link
                              to={profileRoute(repo.owner)}
                              params={{ username: repo.owner }}
                              className="shrink-0 rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              @{repo.owner} →
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={async () => {
                                setPending(true);
                                try {
                                  await addBoard({
                                    data: { username: repo.owner },
                                  });
                                  await router.invalidate();
                                  setMessage(
                                    `Added maintainer @${repo.owner} (${repo.repoName}) to board.`,
                                  );
                                } catch (err) {
                                  setMessage(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not add maintainer",
                                  );
                                } finally {
                                  setPending(false);
                                }
                              }}
                              className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent hover:bg-accent/25"
                            >
                              + Benchmark @{repo.owner}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* Controls Card: Language Cohort Leagues + Time Horizon + Metric Sort + Archetypes */}
      <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-3 shadow-[var(--shadow-border)] sm:p-4">
        {/* Ecosystem Language Cohort League Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:pb-0">
            <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
              Cohort
            </span>
            {LANGUAGE_COHORTS.map((cohort) => {
              const active = activeCohort === cohort.id;
              return (
                <button
                  key={cohort.id || "global"}
                  type="button"
                  disabled={cohortSyncing}
                  onClick={() => void selectLanguageCohort(cohort.id)}
                  className={cn(
                    "shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                    active
                      ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                      : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {cohort.label}
                </button>
              );
            })}
          </div>
          {activeCohort ? (
            <span className="text-xs font-medium text-accent">
              {cohortSyncing
                ? `Syncing live ${activeCohort} builders via treg…`
                : `Showing ${filteredRows.length} builders in ${
                    LANGUAGE_COHORTS.find((c) => c.id === activeCohort)?.label
                  }`}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Time Window Segmented Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              Horizon
            </span>
            <div className="inline-flex rounded-xl bg-secondary p-1">
              {WINDOWS.map((w) => {
                const active = !date && activeWindow === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => go({ window: w.id, date: null })}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-mono text-xs font-medium transition-all",
                      active
                        ? "bg-card text-accent shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title={w.sub}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>

            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={date ? "default" : "outline"}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <CalendarDays className="size-3.5" />
                  {date ? format(parseISO(date), "d MMM yyyy") : "Single day"}
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  key={(date ?? today).slice(0, 7)}
                  mode="single"
                  selected={selected}
                  onSelect={(day) => {
                    if (!day) return;
                    const iso = format(day, "yyyy-MM-dd");
                    if (iso > today) return;
                    go({ date: iso });
                    setDatePopoverOpen(false);
                  }}
                  disabled={{ after: parseISO(today) }}
                  defaultMonth={selected ?? parseISO(today)}
                />
              </PopoverContent>
            </Popover>
            {date ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => go({ sort: "score", date: null })}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          {/* Sort Mode Selector */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:pb-0">
            <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
              Rank by
            </span>
            {SORTS.map((row) => {
              const isSelected = !date && sort === row.id;
              return (
                <Button
                  key={row.id}
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => go({ sort: row.id, date: null })}
                >
                  {row.id === "score" ? (
                    <Sparkles className="mr-1 size-3" />
                  ) : null}
                  <span className="sm:hidden">
                    {row.shortLabel ?? row.label}
                  </span>
                  <span className="hidden sm:inline">{row.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Controls Row 2: Archetype Filter Pills + Search */}
        <div className="flex flex-col gap-2 border-t border-border/50 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:pb-0">
            <button
              type="button"
              onClick={() => setArchetypeFilter("all")}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                archetypeFilter === "all"
                  ? "bg-foreground text-background font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              All ({archetypeCounts.all ?? 0})
            </button>
            {(
              Object.keys(ARCHETYPE_META) as Array<BuilderArchetypeId>
            ).map((id) => {
              const count = archetypeCounts[id] ?? 0;
              if (count === 0) return null;
              const active = archetypeFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setArchetypeFilter(active ? "all" : id)
                  }
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
                    active
                      ? "bg-accent text-accent-foreground font-semibold ring-2 ring-accent/40"
                      : ARCHETYPE_META[id].tone,
                  )}
                >
                  {ARCHETYPE_META[id].badge}{" "}
                  <span className="font-mono tabular-nums">· {count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter builders…"
              className="h-7 w-full rounded-lg border border-border bg-secondary/40 pr-2.5 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Podium Section (Top 3) */}
      {podium.length > 0 && archetypeFilter === "all" && !searchQuery ? (
        <section className="space-y-2.5 sm:space-y-3">
          <Podium3DStage
            items={podium.map((row) => {
              const primary = metricPrimaryLabel(row);
              const score = metricScore(row);
              return {
                rank: row.rank,
                login: row.profile?.login ?? row.username,
                name: row.profile?.name || row.profile?.login || row.username,
                avatarUrl: row.profile?.avatarUrl,
                valueLabel: primary.value,
                subLabel: primary.sub,
                scoreRatio: maxScore > 0 ? score / maxScore : 0.5,
              };
            })}
            onSelectUser={(login) => {
              void navigate({
                to: profileRoute(login),
                params: { username: login },
                search: date ? { d: date } : {},
              });
            }}
          />
          <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
            {podium.map((row) => {
              const primary = metricPrimaryLabel(row);
              const score = metricScore(row);
              const pct = Math.max(8, Math.round((score / maxScore) * 100));
              const arch = ARCHETYPE_META[row.archetype.id];
              const rowLogin = row.profile?.login ?? row.username;
              const rowProfileTo = profileRoute(rowLogin);
              return (
                <Tilt3DCard key={row.username} className="rounded-2xl">
                  <div
                    className={cn(
                      "group relative flex h-full flex-col justify-between gap-3 rounded-2xl bg-card p-3.5 shadow-[var(--shadow-border)] transition-all duration-150 hover:shadow-[var(--shadow-border-hover)] sm:gap-3.5 sm:p-5",
                      row.rank === 1 && "ring-1 ring-accent/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <Link
                        to={rowProfileTo}
                        params={{ username: rowLogin }}
                        search={date ? { d: date } : {}}
                        className="flex min-w-0 items-center gap-2.5 sm:gap-3"
                      >
                        {row.profile ? (
                          <img
                            src={row.profile.avatarUrl}
                            alt=""
                            className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-foreground/15 sm:size-11"
                          />
                        ) : (
                          <span className="size-10 rounded-full bg-muted sm:size-11" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium group-hover:underline">
                            {row.profile?.name ||
                              row.profile?.login ||
                              row.username}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            @{rowLogin}
                          </p>
                        </div>
                      </Link>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold",
                          row.rank === 1
                            ? "bg-heat-4 text-accent-foreground"
                            : "bg-heat-2/50 text-accent",
                        )}
                      >
                        {row.rank === 1 ? <Trophy className="size-3" /> : null}#
                        {row.rank}
                      </span>
                    </div>

                    {/* Archetype + Momentum Pills */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
                          arch.tone,
                        )}
                      >
                        {arch.badge}
                      </span>
                      <MomentumBadge delta={row.momentumDelta} />
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
                          {primary.value}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {primary.sub}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-accent">
                          <Flame className="size-3" />
                          {row.streak}d streak
                        </span>
                        <MiniHeatStrip
                          byDate={row.byDate}
                          today={today}
                          days={14}
                        />
                      </div>
                    </div>

                    {/* 4-Pillar Score Bar or Metric Bar */}
                    {!date && sort === "score" ? (
                      <ScoreBreakdownBar score={row.score} />
                    ) : (
                      <div className="h-1.5 overflow-hidden rounded-full bg-heat-0">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            row.rank === 1 ? "bg-heat-4" : "bg-heat-3",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    {/* Quick Footer Actions */}
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                      <Link
                        to={rowProfileTo}
                        params={{ username: rowLogin }}
                        search={date ? { d: date } : {}}
                        className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
                      >
                        <span>Profile</span>
                        <ArrowUpRight className="size-3" />
                      </Link>
                      {leaderLogin && rowLogin !== leaderLogin ? (
                        <Link
                          to="/compare/$a/$b"
                          params={{ a: leaderLogin, b: rowLogin }}
                          className="inline-flex items-center gap-1 font-mono text-accent hover:underline"
                        >
                          <Swords className="size-3" />
                          <span>vs #{1}</span>
                        </Link>
                      ) : (
                        <span className="font-mono text-muted-foreground">
                          {formatCount(row.total)} commits ({activeWindow})
                        </span>
                      )}
                    </div>
                  </div>
                </Tilt3DCard>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Full Ranked Roster */}
      <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {filteredRows.length === 0 ? (
          <li className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
            No builders match that filter.
          </li>
        ) : null}
        {filteredRows.map((row) => {
          const dayCount = date ? (row.byDate[date] ?? 0) : null;
          const score = metricScore(row);
          const barPct =
            !row.error && score > 0
              ? Math.max(4, Math.round((score / maxScore) * 100))
              : 0;
          const rowLogin = row.profile?.login ?? row.username;
          const rowProfileTo = profileRoute(rowLogin);
          const arch = ARCHETYPE_META[row.archetype.id];

          return (
            <li
              key={row.username.toLowerCase()}
              className="group transition-colors hover:bg-muted/35"
            >
              <div className="px-3.5 py-3 sm:px-5 sm:py-3.5">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <span
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums sm:size-7",
                      row.rank === 1 && !row.error
                        ? "bg-heat-4 text-accent-foreground"
                        : row.rank <= 3 && !row.error
                          ? "bg-heat-2/60 text-foreground"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {row.rank}
                  </span>

                  <Link
                    to={rowProfileTo}
                    params={{ username: rowLogin }}
                    search={date ? { d: date } : {}}
                    className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3"
                  >
                    {row.profile ? (
                      <img
                        src={row.profile.avatarUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10 sm:size-9"
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded-full bg-muted sm:size-9" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium group-hover:underline sm:text-base">
                          {row.profile?.name ||
                            row.profile?.login ||
                            row.username}
                        </span>
                        {!row.error ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              classifyTier(row.score.total).tone,
                            )}
                          >
                            {classifyTier(row.score.total).label}
                          </span>
                        ) : null}
                        {!row.error ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              arch.tone,
                            )}
                          >
                            {arch.badge}
                          </span>
                        ) : null}
                        {!row.error ? (
                          <MomentumBadge delta={row.momentumDelta} compact />
                        ) : null}
                      </div>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        @{rowLogin}
                      </span>
                    </div>
                  </Link>

                  {/* Desktop Heat Strip + Head-to-Head Compare + Multi-Horizon Inspect */}
                  {!row.error ? (
                    <div className="hidden items-center gap-2 lg:flex">
                      <MiniHeatStrip
                        byDate={row.byDate}
                        today={today}
                        days={heatStripDays}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCompareUser(rowLogin)}
                        title={`Select @${rowLogin} for head-to-head comparison`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                          comparePair.includes(rowLogin)
                            ? "border-accent bg-accent/20 text-accent font-semibold"
                            : "border-border/70 bg-secondary/40 text-muted-foreground hover:border-accent/50 hover:text-foreground",
                        )}
                      >
                        <Swords className="size-3" />
                        <span>
                          {comparePair.includes(rowLogin)
                            ? "Picked"
                            : "Pick vs"}
                        </span>
                      </button>
                      {leaderLogin && rowLogin !== leaderLogin ? (
                        <Link
                          to="/compare/$a/$b"
                          params={{ a: leaderLogin, b: rowLogin }}
                          title={`Compare @${rowLogin} vs #1 @${leaderLogin}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/40 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          <span>vs #1</span>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void toggleExpandUser(rowLogin)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                          expandedUser === rowLogin
                            ? "border-accent/60 bg-secondary text-accent"
                            : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {expandedUser === rowLogin ? "Hide" : "Inspect"}
                      </button>
                    </div>
                  ) : null}

                  {row.error ? (
                    <span className="text-xs text-muted-foreground">
                      {row.error}
                    </span>
                  ) : (
                    <dl className="grid w-full grid-cols-5 gap-1.5 border-t border-border/40 pt-2 text-left text-xs sm:w-auto sm:gap-x-4 sm:gap-y-1 sm:border-0 sm:pt-0 sm:text-right sm:text-sm">
                      {date ? (
                        <Stat
                          label={format(parseISO(date), "d MMM")}
                          value={formatCount(dayCount ?? 0)}
                          active
                        />
                      ) : (
                        <Stat
                          label="Score"
                          value={`${row.score.total}`}
                          hint="/100"
                          active={sort === "score"}
                        />
                      )}
                      <Stat
                        label="Streak"
                        value={`${row.streak}d`}
                        hint={`/${row.longest}d`}
                        active={!date && sort === "streak"}
                      />
                      <Stat
                        label="Active"
                        value={`${Math.round(row.consistency * 100)}%`}
                        hint={`${row.activeDays}d`}
                        active={
                          !date &&
                          (sort === "consistency" || sort === "active")
                        }
                      />
                      <Stat
                        label="Volume"
                        value={formatCount(row.total)}
                        active={!date && sort === "volume"}
                      />
                      <Stat
                        label="Peak"
                        value={
                          row.bestDay
                            ? `${formatCount(row.bestDay.count)}`
                            : "—"
                        }
                        active={!date && sort === "peak"}
                      />
                    </dl>
                  )}
                </div>

                {/* Mobile Heat Strip + Compare Row + 4-Pillar Score Bar */}
                {!row.error ? (
                  <div className="mt-2 flex flex-col gap-1.5 sm:mt-2.5 sm:pl-10">
                    <div className="flex flex-wrap items-center justify-between gap-2 lg:hidden">
                      <MiniHeatStrip
                        byDate={row.byDate}
                        today={today}
                        days={14}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleCompareUser(rowLogin)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                            comparePair.includes(rowLogin)
                              ? "bg-accent text-accent-foreground font-semibold"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Swords className="size-2.5" />
                          <span>
                            {comparePair.includes(rowLogin)
                              ? "Picked"
                              : "Pick vs"}
                          </span>
                        </button>
                        {leaderLogin && rowLogin !== leaderLogin ? (
                          <Link
                            to="/compare/$a/$b"
                            params={{ a: leaderLogin, b: rowLogin }}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-accent"
                          >
                            <span>vs #{1}</span>
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void toggleExpandUser(rowLogin)}
                          className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {expandedUser === rowLogin ? "Hide" : "Inspect"}
                        </button>
                      </div>
                    </div>
                    {!date && sort === "score" ? (
                      <ScoreBreakdownBar score={row.score} compact />
                    ) : (
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-heat-3 transition-all duration-300"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    )}

                    {/* Inline Multi-Horizon, 4-Pillar & Shipped Portfolio Diagnostic Drawer */}
                    {expandedUser === rowLogin ? (
                      <div className="mt-2 space-y-3 rounded-xl border border-border/70 bg-secondary/35 p-3 text-xs">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              4-Pillar Cadence Breakdown ({activeWindow})
                            </p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div className="rounded-lg bg-card px-2.5 py-1.5">
                                <span className="text-muted-foreground">
                                  Consistency:{" "}
                                </span>
                                <span className="font-mono font-semibold text-accent tabular-nums">
                                  {row.score.consistencyPts}/35
                                </span>
                              </div>
                              <div className="rounded-lg bg-card px-2.5 py-1.5">
                                <span className="text-muted-foreground">
                                  Streak:{" "}
                                </span>
                                <span className="font-mono font-semibold text-foreground tabular-nums">
                                  {row.score.streakPts}/25
                                </span>
                              </div>
                              <div className="rounded-lg bg-card px-2.5 py-1.5">
                                <span className="text-muted-foreground">
                                  Log output:{" "}
                                </span>
                                <span className="font-mono font-semibold text-foreground tabular-nums">
                                  {row.score.outputPts}/25
                                </span>
                              </div>
                              <div className="rounded-lg bg-card px-2.5 py-1.5">
                                <span className="text-muted-foreground">
                                  Rhythm:{" "}
                                </span>
                                <span className="font-mono font-semibold text-foreground tabular-nums">
                                  {row.score.rhythmPts}/15
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              All-horizon trajectory
                            </p>
                            <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px] tabular-nums">
                              {WINDOWS.map((w) => {
                                const ws = computeWindowStats(row, w.id, today);
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() =>
                                      go({ window: w.id, date: null })
                                    }
                                    className={cn(
                                      "rounded-lg bg-card p-1.5 text-left transition-colors hover:bg-secondary",
                                      activeWindow === w.id &&
                                        "ring-1 ring-accent/50",
                                    )}
                                  >
                                    <p className="text-[10px] text-muted-foreground">
                                      {w.label}
                                    </p>
                                    <p className="font-semibold text-accent">
                                      {ws.score.total}pt
                                    </p>
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      {formatCount(ws.total)}c
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Builder Portfolio & Shipped Repositories Enrichment (treg / GitHub) */}
                        <div className="border-t border-border/50 pt-2.5">
                          {portfolioLoading === rowLogin.toLowerCase() ? (
                            <p className="text-xs text-muted-foreground">
                              Loading @{rowLogin}&apos;s shipped repositories &
                              stack…
                            </p>
                          ) : portfolios[rowLogin.toLowerCase()] ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Shipped portfolio
                                  </span>
                                  <span className="rounded-full bg-accent/15 px-2 py-0.2 font-mono text-[10px] text-accent tabular-nums">
                                    ★{" "}
                                    {formatCount(
                                      portfolios[rowLogin.toLowerCase()]!
                                        .totalStars,
                                    )}{" "}
                                    stars
                                  </span>
                                  {portfolios[
                                    rowLogin.toLowerCase()
                                  ]!.topLanguages.map((lang) => (
                                    <span
                                      key={lang.language}
                                      className="rounded-md bg-card px-1.5 py-0.2 text-[11px] font-medium text-foreground shadow-[var(--shadow-border)]"
                                    >
                                      {lang.language}{" "}
                                      <span className="font-mono text-muted-foreground tabular-nums">
                                        ({lang.count})
                                      </span>
                                    </span>
                                  ))}
                                </div>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  source:{" "}
                                  {portfolios[rowLogin.toLowerCase()]!.source}
                                </span>
                              </div>

                              {portfolios[rowLogin.toLowerCase()]!.repos
                                .length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  {portfolios[rowLogin.toLowerCase()]!.repos
                                    .slice(0, 3)
                                    .map((repo) => (
                                      <a
                                        key={repo.fullName}
                                        href={repo.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex flex-col justify-between gap-1 rounded-lg bg-card p-2 shadow-[var(--shadow-border)] transition-colors hover:border-accent/50"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-1.5">
                                            <span className="truncate font-mono text-[11px] font-semibold text-foreground hover:text-accent">
                                              {repo.name}
                                            </span>
                                            <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-accent tabular-nums">
                                              <Star className="size-2.5" />
                                              {formatCount(repo.stars)}
                                            </span>
                                          </div>
                                          {repo.description ? (
                                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                                              {repo.description}
                                            </p>
                                          ) : null}
                                        </div>
                                        {repo.language ? (
                                          <span className="text-[10px] font-medium text-muted-foreground">
                                            {repo.language}
                                          </span>
                                        ) : null}
                                      </a>
                                    ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore
              ? "Loading…"
              : `Load more builders (${formatCount(validEntries.length)} of ${formatCount(total)})`}
          </Button>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-muted-foreground">
        Global index of up to {formatCount(max)} verified builders, discovered
        from the public GitHub event stream, follower sweeps, and trending —
        refreshed every 3 hours
        {indexer?.lastRun
          ? ` · last run ${indexer.lastRun.status} ${new Date(indexer.lastRun.startedAt).toLocaleString()}`
          : ""}
        {indexer?.queue.pending
          ? ` · ${formatCount(indexer.queue.pending)} candidates queued`
          : ""}
        {indexer?.botsFiltered
          ? ` · ${formatCount(indexer.botsFiltered)} bots filtered`
          : ""}
        .
      </p>

      {/* Sticky 2-Builder Compare Dock */}
      {comparePair.length > 0 ? (
        <div className="sticky bottom-3 z-30 mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
            <Swords className="size-4 shrink-0 text-accent" />
            <span className="truncate font-semibold text-foreground">
              @{comparePair[0]}
            </span>
            <span className="font-sans text-muted-foreground">vs</span>
            {comparePair[1] ? (
              <span className="truncate font-semibold text-accent">
                @{comparePair[1]}
              </span>
            ) : (
              <span className="font-sans text-muted-foreground">
                pick 2nd builder…
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {comparePair.length === 2 ? (
              <Button asChild size="sm" className="h-7 px-3 text-xs">
                <Link
                  to="/compare/$a/$b"
                  params={{ a: comparePair[0]!, b: comparePair[1]! }}
                >
                  Compare now
                </Link>
              </Button>
            ) : leaderLogin && comparePair[0] !== leaderLogin ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
              >
                <Link
                  to="/compare/$a/$b"
                  params={{ a: leaderLogin, b: comparePair[0]! }}
                >
                  vs #{1} @{leaderLogin}
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setComparePair([])}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreBreakdownBar({
  score,
  compact = false,
}: {
  score: ScoreBreakdown;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex overflow-hidden rounded-full bg-heat-0",
          compact ? "h-1.5" : "h-2",
        )}
        title={`Cadence Score ${score.total}/100 — Consistency: ${score.consistencyPts}/35 · Streak: ${score.streakPts}/25 · Output: ${score.outputPts}/25 · Rhythm: ${score.rhythmPts}/15`}
      >
        <div
          className="h-full bg-heat-4 transition-all duration-300"
          style={{ width: `${score.consistencyPts}%` }}
        />
        <div
          className="h-full bg-heat-3 transition-all duration-300"
          style={{ width: `${score.streakPts}%` }}
        />
        <div
          className="h-full bg-heat-2 transition-all duration-300"
          style={{ width: `${score.outputPts}%` }}
        />
        <div
          className="h-full bg-heat-1 transition-all duration-300"
          style={{ width: `${score.rhythmPts}%` }}
        />
      </div>
      {!compact ? (
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
          <span>C:{score.consistencyPts}</span>
          <span>S:{score.streakPts}</span>
          <span>O:{score.outputPts}</span>
          <span>R:{score.rhythmPts}</span>
        </div>
      ) : null}
    </div>
  );
}

function MomentumBadge({
  delta,
  compact = false,
}: {
  delta: number | null;
  compact?: boolean;
}) {
  if (delta === null || Math.abs(delta) < 3) return null;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-mono tabular-nums",
        compact ? "px-1.5 py-0.2 text-[10px]" : "px-2 py-0.5 text-[10px]",
        up
          ? "bg-heat-3/20 text-accent"
          : "bg-secondary text-muted-foreground",
      )}
      title="Recent velocity change vs prior period"
    >
      {up ? (
        <TrendingUp className="size-2.5" />
      ) : (
        <TrendingDown className="size-2.5" />
      )}
      <span>
        {up ? "+" : ""}
        {delta}%
      </span>
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  active,
}: {
  label: string;
  value: string;
  hint?: string;
  active?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate font-mono tabular-nums",
          active ? "font-semibold text-accent" : "text-foreground",
        )}
      >
        {value}
        {hint ? (
          <span className="ml-0.5 hidden text-[11px] font-normal text-muted-foreground sm:inline">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
