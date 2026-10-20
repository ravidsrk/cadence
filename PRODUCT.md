# Product Context: Cadence

## What It Is

Cadence (`git-cadence.grok.me`) is a public GitHub shipping intelligence instrument. It transforms any public developer's contribution history into an interactive 3D isometric skyline, a 2D heatmap calendar, a 0–100 Composite Cadence Score across four weighted pillars (Consistency, Streak Durability, Log Output, Anti-Spike Rhythm), head-to-head developer comparisons, and a live competitive leaderboard enriched by `treg` GitHub Trending discovery.

## Who It Serves

- **Open-source maintainers and software engineers** who want to inspect, benchmark, and share their shipping rhythm in GitHub READMEs, portfolios, and social posts.
- **Engineering leads and developer communities** comparing consistency, active streaks, and language ecosystem velocity across public GitHub builders.

## Core Surfaces & Visitor Modes

- **Dashboard (`/` and `/u/$username`) — Operate Mode:** Inspect a builder's 3D contribution skyline, daily commit vs merged PR split, consistency ring, weekday rhythm, 14-day pulse, and shipped repository portfolio.
- **Leaderboard (`/board`) — Operate Mode:** Rank builders across rolling time horizons (`7D`, `30D`, `90D`, `12M`), ecosystem language cohorts (`TypeScript`, `Python`, `Rust`, `Go`), and live GitHub Trending discovery.
- **Compare (`/compare` and `/compare/$a/$b`) — Operate Mode:** Side-by-side 4-pillar tug-of-war, dual 3D skylines (emerald vs sky), and monthly momentum deltas.
- **Year Recap (`/u/$username/$year`) — Experience / Operate Mode:** Annual shipping summary with full-year 4-pillar score, language donut, and commits-vs-PRs ratio.
- **Docs & Embed Studio (`/docs`) — Read / Operate Mode:** Live README SVG & iframe embed generator paired with concise product documentation.

## Direction and delivery status

The [roadmap](./ROADMAP.md) and [October 2026 research](./docs/research/2026-10-20-product-roadmap.md) extend these existing surfaces. Prioritize a trustworthy index, measurable discovery coverage, historical change, and repeatable weekly value. Keep the skyline, comparisons, annual recap, sharing, and existing score foundations.

Leaderboard ranks describe a defined indexed population at an observation time, not an exhaustive ranking of GitHub. The Cadence score describes observed contribution rhythm; its product weights do not establish developer quality, total productivity, or causal AI impact. Ecosystem cohorts, freshness guarantees, automation assessment, and metric provenance need the roadmap's release checks before stronger claims.

The current indexer has a 10,000-profile admission cap. Removing that cap, adding historical snapshots, reliable weekly recaps, ownership/correction flows, and ecosystem pilots are planned work, not shipped features. See the roadmap for issue-level acceptance criteria and dependencies.
