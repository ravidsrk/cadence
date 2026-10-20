import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  GitCompareArrows,
  LayoutGrid,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { readLastViewedProfile } from "@/lib/github/recent";
import { isReservedRoute, parseGithubUsername } from "@/lib/github/username";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid grid-cols-2 gap-[2px] rounded-md bg-secondary p-1.5 shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <span className="size-1.5 rounded-[1.5px] bg-heat-1" />
      <span className="size-1.5 rounded-[1.5px] bg-heat-3" />
      <span className="size-1.5 rounded-[1.5px] bg-heat-2" />
      <span className="size-1.5 rounded-[1.5px] bg-heat-4" />
    </span>
  );
}

export function AppHeader({
  subtitle,
  compareUsername,
  activeUsername,
  hideSearch = false,
  className,
}: {
  subtitle?: string;
  compareUsername?: string;
  activeUsername?: string;
  hideSearch?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <BrandMark />
          <span className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Cadence
          </span>
        </Link>
        {subtitle ? (
          <>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          </>
        ) : null}
      </div>
      <SiteNav
        compareUsername={compareUsername}
        activeUsername={activeUsername}
        hideSearch={hideSearch}
      />
    </div>
  );
}

export function SiteNav({
  compareUsername,
  activeUsername,
  hideSearch = false,
  className,
}: {
  compareUsername?: string;
  activeUsername?: string;
  hideSearch?: boolean;
  className?: string;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastViewed, setLastViewed] = useState<string | null>(null);

  const displayUser = activeUsername ?? lastViewed;
  const isLanding = pathname === "/" || hideSearch;
  const isCompare = pathname.startsWith("/compare");
  const isBoard = pathname.startsWith("/board");
  const isDocs = pathname.startsWith("/docs");
  const isProfile =
    Boolean(activeUsername) &&
    !isLanding &&
    !isCompare &&
    !isBoard &&
    !isDocs &&
    !pathname.startsWith("/embed");

  useEffect(() => {
    setLastViewed(readLastViewedProfile());
  }, [pathname]);

  useEffect(() => {
    if (isLanding) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setSearchError(null);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLanding]);

  function onHeaderSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const raw = query.trim();

    const vsParts = raw.split(/\s+vs\.?\s+|\s*,\s*/i).filter(Boolean);
    if (vsParts.length === 2) {
      const a = parseGithubUsername(vsParts[0]!);
      const b = parseGithubUsername(vsParts[1]!);
      if (
        a.ok &&
        b.ok &&
        a.username.toLowerCase() !== b.username.toLowerCase()
      ) {
        setSearchError(null);
        setQuery("");
        inputRef.current?.blur();
        void navigate({
          to: "/compare/$a/$b",
          params: { a: a.username, b: b.username },
        });
        return;
      }
    }

    const parsed = parseGithubUsername(raw);
    if (!parsed.ok) {
      setSearchError(parsed.error);
      return;
    }

    setSearchError(null);
    setQuery("");
    inputRef.current?.blur();
    if (parsed.isReserved) {
      void navigate({
        to: "/u/$username",
        params: { username: parsed.username },
      });
    } else {
      void navigate({
        to: "/$username",
        params: { username: parsed.username },
      });
    }
  }

  const itemClass = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
      active
        ? "bg-secondary text-foreground ring-1 ring-border"
        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {!isLanding ? (
        <div className="relative order-2 w-full sm:order-1 sm:w-auto">
          <form
            onSubmit={onHeaderSearchSubmit}
            autoComplete="off"
            role="search"
            aria-label="Jump to GitHub profile"
            className="relative flex items-center"
          >
            <label htmlFor="header-username-search" className="sr-only">
              Search GitHub username
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 size-3.5 text-accent"
            />
            <input
              ref={inputRef}
              id="header-username-search"
              name="header-username-search"
              type="text"
              value={query}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setQuery(e.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Jump to user…"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              data-1p-ignore=""
              data-lpignore="true"
              data-form-type="other"
              aria-invalid={searchError ? "true" : undefined}
              aria-describedby={
                searchError ? "header-username-search-error" : undefined
              }
              className={cn(
                "h-9 w-full rounded-xl bg-card pr-12 pl-8 font-mono text-xs text-foreground shadow-[var(--shadow-border)] transition-all duration-150 placeholder:font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:outline-none",
                focused || query ? "sm:w-64" : "sm:w-44",
              )}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setSearchError(null);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 rounded border border-border/80 bg-secondary/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            )}
          </form>
          {searchError ? (
            <p
              id="header-username-search-error"
              role="alert"
              className="mt-1 text-xs text-rose-400 sm:absolute sm:top-full sm:right-0 sm:z-30 sm:mt-1.5 sm:w-72 sm:rounded-lg sm:border sm:border-rose-500/30 sm:bg-card sm:px-2.5 sm:py-1.5 sm:shadow-lg"
            >
              {searchError}
            </p>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label="Primary navigation"
        className={cn(
          "order-1 inline-flex w-full items-center justify-between gap-1 rounded-xl bg-card p-1 shadow-[var(--shadow-border)] sm:order-2 sm:w-auto sm:justify-start",
        )}
      >
        {(activeUsername ?? lastViewed) ? (
          <Link
            to={
              isReservedRoute(activeUsername ?? lastViewed!)
                ? "/u/$username"
                : "/$username"
            }
            params={{ username: activeUsername ?? lastViewed! }}
            aria-current={isProfile ? "page" : undefined}
            className={itemClass(isProfile)}
            title={`Profile (@${activeUsername ?? lastViewed})`}
          >
            <LayoutGrid className="size-3.5 shrink-0 text-accent" />
            <span className="truncate font-mono text-xs">
              @{activeUsername ?? lastViewed}
            </span>
          </Link>
        ) : null}
        <Link
          to="/compare"
          search={compareUsername ? { a: compareUsername } : {}}
          aria-current={isCompare ? "page" : undefined}
          className={itemClass(isCompare)}
        >
          <GitCompareArrows className="size-3.5 shrink-0" />
          <span className="truncate">Compare</span>
        </Link>
        <Link
          to="/board"
          aria-current={isBoard ? "page" : undefined}
          className={itemClass(isBoard)}
        >
          <Trophy className="size-3.5 shrink-0" />
          <span className="truncate">Board</span>
        </Link>
        <Link
          to="/docs"
          aria-current={isDocs ? "page" : undefined}
          className={itemClass(isDocs)}
        >
          <BookOpen className="size-3.5 shrink-0" />
          <span className="truncate">Docs</span>
        </Link>
      </nav>
    </div>
  );
}
