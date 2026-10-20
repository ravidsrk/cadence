import { createFileRoute, Link } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { CompareForm } from "@/components/dashboard/compare-view";
import { AppHeader } from "@/components/dashboard/site-nav";
import { validateCompareHomeSearch } from "@/lib/github/search";

const FEATURED_MATCHUPS: {
  title: string;
  tag: string;
  a: string;
  b: string;
  desc: string;
}[] = [
  {
    title: "Framework Architects",
    tag: "Vue vs Svelte",
    a: "yyx990803",
    b: "Rich-Harris",
    desc: "Daily shipping rhythm and multi-month streak durability across modern UI compiler authors.",
  },
  {
    title: "Systems & Rust Legends",
    tag: "Kernel vs Rust",
    a: "torvalds",
    b: "BurntSushi",
    desc: "High-frequency daily Linux kernel merges pitted against sustained Rust core tooling cadence.",
  },
  {
    title: "Open Source Titans",
    tag: "ESM vs Vite/Vue",
    a: "sindresorhus",
    b: "antfu",
    desc: "Two of the most prolific open-source package maintainers head-to-head across all 4 pillars.",
  },
  {
    title: "AI & Cloud Pioneers",
    tag: "LLMs vs Edge",
    a: "karpathy",
    b: "rauchg",
    desc: "Deep-focus burst engineering compared against continuous platform shipping.",
  },
  {
    title: "React Ecosystem",
    tag: "Core vs TanStack",
    a: "gaearon",
    b: "tannerlinsley",
    desc: "Compare active-day ratio, peak output days, and weekday rhythm.",
  },
  {
    title: "UI & Design Systems",
    tag: "Cadence vs shadcn/ui",
    a: "ravidsrk",
    b: "shadcn",
    desc: "Benchmark daily shipping velocity, streak bars, and 3D skyline density.",
  },
];

export const Route = createFileRoute("/compare/")({
  validateSearch: (search: Record<string, unknown>) =>
    validateCompareHomeSearch(search),
  head: () => ({
    meta: [
      { title: "Compare · Cadence" },
      {
        name: "description",
        content: "Compare two public GitHub shipping calendars side by side.",
      },
    ],
  }),
  component: CompareHome,
});

function CompareHome() {
  const search = Route.useSearch();
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 overflow-x-hidden px-3.5 py-4 sm:gap-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3.5 sm:gap-5">
        <AppHeader subtitle="Head-to-head arena" />
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
            Compare two builders side by side
          </h1>
          <p className="max-w-xl text-xs text-muted-foreground sm:text-sm">
            Pit any two public GitHub profiles against each other across
            Composite Cadence Score, League Tiers, 3D Skylines, and monthly
            momentum.
          </p>
        </div>
      </header>

      <CompareForm leftDefault={search.a ?? ""} />

      {/* Featured Rivalries Arena */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-accent" />
            <h2 className="font-display text-lg font-semibold">
              Featured rivalries
            </h2>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            1-tap instant comparison
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_MATCHUPS.map((m) => (
            <Link
              key={`${m.a}-${m.b}`}
              to="/compare/$a/$b"
              params={{ a: m.a, b: m.b }}
              className="group flex flex-col justify-between gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] transition-all duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-foreground group-hover:text-accent">
                    {m.title}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {m.tag}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/45 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={`https://github.com/${m.a}.png?size=64`}
                      alt=""
                      className="size-7 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
                    />
                    <span className="truncate font-mono text-xs font-semibold text-accent">
                      @{m.a}
                    </span>
                  </div>
                  <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    vs
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs font-semibold text-sky-300">
                      @{m.b}
                    </span>
                    <img
                      src={`https://github.com/${m.b}.png?size=64`}
                      alt=""
                      className="size-7 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
                    />
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {m.desc}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                <span>Open 4-pillar breakdown</span>
                <span className="text-accent">Compare →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
