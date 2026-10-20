# Cadence roadmap

Updated **20 October 2026**. Tracking issue: [#1](https://github.com/ravidsrk/cadence/issues/1). Evidence and decisions: [product research](docs/research/2026-10-20-product-roadmap.md).

This roadmap consolidates the existing [product direction](PRODUCT.md), [design decisions](DESIGN.md), and implemented leaderboard plan. No earlier roadmap file, GitHub backlog, milestones, or repository-linked project existed when this review began. The tables below describe **future work**; implementation already in the repo is listed separately.

## Product direction

Help developers understand, revisit, and share their observed GitHub contribution rhythm. Keep the skyline, transparent four-pillar score, comparisons, annual recap, and embeddable graphics. Build trust and repeat usefulness before expanding into ecosystem analytics.

A rank is among indexed accounts for a stated window, cohort, observation time, and metric version. Broader discovery improves coverage; it does not establish a complete ranking of every GitHub developer. Contribution activity does not measure work quality or establish AI productivity gains. [Visibility model](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile), [measurement research](docs/research/2026-10-20-product-roadmap.md#papers-findings-limitations-and-product-decisions)

## Implemented baseline

- Interactive profile skyline, heatmap, day inspection, public commit/merged-PR details, comparisons, and annual recap.
- Four-pillar Cadence score and league/archetype presentation.
- SVG, PNG, CSV, badge, and iframe sharing foundations.
- ClickHouse/public-event, follower-search, trending, and organic candidate discovery.
- Candidate queue, batched GraphQL verification, heavy-account fallback, heuristic automation assessment, materialized SQL metrics, and pagination.
- Cron route, manual indexer CLI, migrations, canonical reserved-username routing, and reliability/export fixes.

Baseline commit: [`edee5d9`](https://github.com/ravidsrk/cadence/commit/edee5d9). Typecheck/tests/build pass; lint has five warnings and no errors. These checks establish a working code baseline, not completion of the production gates below.

## Delivery and prioritization

Four outcome milestones, with **28 executable issues** and a single tracking issue. P0 protects correctness or durable operation; P1 is the next release’s core value; P2 is a pilot or optional follow-up. Sizes are rough engineering effort: S = 1–2 days, M = 3–5 days, L = 6–10 days, excluding waiting for external studies. Dependencies and acceptance/validation details are in each issue.

No team capacity or delivery dates are committed. The issue sizes total roughly 96–160 engineering days for M1–M3 before the conditional pilots. With two dedicated engineers, budget approximately 12–20 calendar weeks including integration and pilot time; one engineer needs a longer horizon or a smaller scope. Re-estimate after M1, prioritize the five P0 fixes first, and use the gates to decide whether to proceed. M4 has no fixed delivery date.

### M1 — Trusted index

Fix observable correctness and operational gaps, establish baselines, and make the product’s claims match its data.

| Work item                                                                                                                               | Priority | Size | Outcome                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------------------------------------------------------------------- |
| [#2 — Fix stale-profile requeueing and reset retry state per refresh cycle](https://github.com/ravidsrk/cadence/issues/2)               | P0       | M    | Completed profiles re-enter refresh; retries have a per-cycle budget                      |
| [#3 — Lease candidate work atomically across concurrent indexer workers](https://github.com/ravidsrk/cadence/issues/3)                  | P0       | M    | Concurrent workers own distinct, recoverable leases                                       |
| [#4 — Make every leaderboard sort and window authoritative across pages](https://github.com/ravidsrk/cadence/issues/4)                  | P0       | L    | SQL ranks the whole requested population consistently across pages                        |
| [#5 — Verify durable production storage and the emitted cron function configuration](https://github.com/ravidsrk/cadence/issues/5)      | P0       | M    | Durable production database, working cron routing/budgets, migration and recovery runbook |
| [#6 — Unify contribution provenance, missing-data states, and product documentation](https://github.com/ravidsrk/cadence/issues/6)      | P0       | L    | Unknown/partial/private data stays explicit; score and storage docs match code            |
| [#7 — Control indexing by observed GitHub limits, deadlines, and provider spend](https://github.com/ravidsrk/cadence/issues/7)          | P1       | M    | Adaptive GitHub limits, deadlines, provider spend caps, and reserved refresh capacity     |
| [#8 — Add indexer integration, migration, and multi-page ranking release checks](https://github.com/ravidsrk/cadence/issues/8)          | P1       | M    | Queue, concurrency, migration, and ranking regressions block release                      |
| [#9 — Keep public discovery and refresh requests inside bounded background jobs](https://github.com/ravidsrk/cadence/issues/9)          | P1       | M    | Visitor actions enqueue bounded jobs without unbounded upstream fan-out                   |
| [#23 — Measure and improve mobile, keyboard, and reduced-motion skyline use](https://github.com/ravidsrk/cadence/issues/23)             | P1       | M    | Mobile, keyboard, screen-reader, and reduced-motion flows are measured and usable         |
| [#24 — Measure activation, return visits, sharing, and index quality before growth work](https://github.com/ravidsrk/cadence/issues/24) | P1       | M    | Activation, returns, sharing, latency, and freshness have explicit baselines              |
| [#25 — Validate maintainer demand and pricing with interviews and a bounded X study](https://github.com/ravidsrk/cadence/issues/25)     | P1       | M    | Maintainer interviews and a bounded social study test audience/value assumptions          |

**Release gate:** queue refresh/recovery and multi-page ranking fixtures pass; partial fetches cannot overwrite good data; public responses pass visibility checks; a staging cron runs against durable storage; generated deployment configuration and restore behavior are verified. Observe at least 48 hours of scheduling without duplicate ownership or stranded work. Record two weeks of product baseline data before setting growth targets. The X study can remain pending until authorized data access is available; it is required before social-demand claims or pricing bets.

### M2 — Coverage and history

Broaden discovery, make coverage measurable, scale read paths, and explain ranks over time.

| Work item                                                                                                                                  | Priority | Size | Outcome                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ---------------------------------------------------------------------------------------- |
| [#10 — Persist discovery cursors and reach low-follower and specialist contributors](https://github.com/ravidsrk/cadence/issues/10)        | P1       | L    | Persistent search partitions and independent lanes discover overlooked specialists       |
| [#11 — Publish coverage and freshness measurements with a held-out recall benchmark](https://github.com/ravidsrk/cadence/issues/11)        | P1       | M    | Dated coverage/freshness page and a held-out recall benchmark                            |
| [#12 — Remove the 10,000-profile storage ceiling and paginate lightweight ranking rows](https://github.com/ravidsrk/cadence/issues/12)     | P1       | L    | Storage grows beyond 10,000; compact rows, appropriate indexes, stable cursor pagination |
| [#13 — Store daily snapshots for rank history and reproducible momentum](https://github.com/ravidsrk/cadence/issues/13)                    | P1       | L    | Reproducible daily snapshots, newcomers, and meaningful rank movement                    |
| [#14 — Build server-ranked language and community cohorts with documented membership](https://github.com/ravidsrk/cadence/issues/14)       | P1       | L    | Evidence-based ecosystem membership filters the full server-ranked population            |
| [#15 — Calibrate automation assessment and provide reviewable exclusion reasons](https://github.com/ravidsrk/cadence/issues/15)            | P1       | L    | Calibrated, reviewable automation decisions shared by all write paths                    |
| [#16 — Version and explain the Cadence score; evaluate weekly rhythm as an alternative](https://github.com/ravidsrk/cadence/issues/16)     | P1       | M    | Versioned score, worked examples, sensitivity report, optional weekly rhythm evaluation  |
| [#17 — Let developers verify profile ownership, request corrections, and suppress indexing](https://github.com/ravidsrk/cadence/issues/17) | P1       | M    | Verified ownership, corrections, bounded refresh, and persistent suppression             |

**Release gate:** at least 95% recall on the declared held-out known-positive benchmark, with cohort sample sizes and every miss disclosed. Target at least 99% precision for automatic exclusions on a separate labeled set; use review for uncertainty. Target p95 freshness within six hours for the top 1,000 and 48 hours for other active indexed profiles, subject to measured capacity. Target p95 warm ranking query under 200ms and compressed first page under 100KB on a documented 100k-row staging dataset. These are targets, not claims about current service performance or complete GitHub coverage.

The current default of 256 candidates every three hours can claim at most 2,048 profiles/day before retries/timeouts. Rework the drain schedule and measure capacity before promising the freshness targets. Source checkpoints, observed costs, failure isolation, and a maximum daily budget are mandatory.

### M3 — Return and share

Give developers a useful weekly loop: inspect their work, understand changes, revisit peers, and share a reliable artifact.

| Work item                                                                                                                            | Priority | Size | Outcome                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | -------------------------------------------------------------------------------------------- |
| [#18 — Show a contribution portfolio with reviews, merged work, issues, and releases](https://github.com/ravidsrk/cadence/issues/18) | P1       | L    | Reviews, maintenance, issues, releases, and merged work have source-linked context           |
| [#19 — Generate a source-linked weekly recap and personal change view](https://github.com/ravidsrk/cadence/issues/19)                | P1       | M    | Deterministic weekly personal recap with comparable periods and evidence links               |
| [#20 — Save private watchlists and compare nearby peers over time](https://github.com/ravidsrk/cadence/issues/20)                    | P1       | M    | Private local watchlists and consistent saved peer comparisons                               |
| [#21 — Offer opt-in weekly digests with preview, preferences, and unsubscribe](https://github.com/ravidsrk/cadence/issues/21)        | P2       | M    | Explicitly subscribed weekly digest with preview, unsubscribe, and duplicate-send prevention |
| [#22 — Make README embeds durable with snapshot delivery and a GitHub Actions export](https://github.com/ravidsrk/cadence/issues/22) | P1       | M    | Snapshot cards, last-good delivery, and a least-privilege GitHub Actions export              |

**Release gate:** users can identify what changed and inspect the source for every recap headline; no incomplete baseline is invented. Complete the lookup → day inspection → compare → export flow on mobile and keyboard. Evaluate return rate and successful sharing against M1’s measured cohorts, with sample sizes and uncertainty. Interview at least ten opted-in pilot users and record usefulness/retention findings before expanding notifications or paid acquisition. A static README artifact must remain usable during an upstream outage.

### M4 — Ecosystem pilots

Start these only when M1/M2 operational gates hold and M3 has repeat-use evidence.

| Work item                                                                                                                                    | Priority | Size | Decision gate                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------------------------------------------------------- |
| [#26 — Pilot community boards with explicit membership and collaboration context](https://github.com/ravidsrk/cadence/issues/26)             | P2       | L    | Up to three volunteer communities demonstrate an actual discovery/collaboration job                |
| [#27 — Publish a versioned leaderboard API and CSV export from authoritative snapshots](https://github.com/ravidsrk/cadence/issues/27)       | P2       | M    | At least one external consumer validates the versioned snapshot contract                           |
| [#28 — Evaluate collaboration and downstream-impact signals in a separate research prototype](https://github.com/ravidsrk/cadence/issues/28) | P2       | L    | Collaboration/impact prototype improves on simple baselines with acceptable bias/cost              |
| [#29 — Prototype grounded AI recap narration only after deterministic recaps prove useful](https://github.com/ravidsrk/cadence/issues/29)    | P2       | M    | Grounded narration beats the deterministic recap on usefulness without unacceptable factual errors |

Every pilot ends with a recorded go/no-go decision. Experimental impact remains separate from the existing rhythm score. AI does not infer developer quality, AI-tool usage, or causal productivity from contribution patterns.

## Dependency order

1. Queue lifecycle/leases, ranking, and provenance unblock safe operation.
2. Deployment, rate/spend control, request bounds, and integration CI establish the release foundation. Accessibility and product measurement can proceed alongside that work.
3. Persisted discovery plus coverage measurement unblock scale and defensible cohorts; ranking/provenance plus refresh unblock history.
4. Coverage and labeled evidence precede automation thresholds and score experiments; ownership flows use the resulting correction/suppression contract.
5. History plus contribution portfolios unblock weekly recaps; cohorts/history unblock watchlists; verified subscriptions and recaps unblock digests.
6. Pilot community/API/impact/AI work only after its listed issue dependencies and product evidence gates.

## Success measures

| Dimension           | Definition / target                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ranking correctness | Exact agreement with independent reference fixtures for every supported sort/window/cohort and page boundary                                |
| Freshness           | Age since last successful complete observation; report top-tier and wider-index distributions separately                                    |
| Coverage            | Known-positive recall and source yield/overlap, broken down by declared cohort; no all-GitHub recall claim                                  |
| Eligibility         | Measured exclusion precision, review volume, reversals, and unresolved cases                                                                |
| User value          | Activated visitor = successful profile view plus intentional day inspection, comparison, or export; measure weekly return and useful recaps |
| Sharing             | Successful exports and voluntarily installed static artifacts; no invented view counts                                                      |
| Cost                | Observed provider spend, GitHub cost/latency, database storage, and cost per verified profile/returning user                                |
| Experience          | Accessibility task completion; target field p75 LCP ≤2.5s and INP ≤200ms when field data is sufficient                                      |

Targets become service commitments only after they are measured on the deployed configuration and funded within a stated budget. If a gate fails, narrow the population/features or revise the target transparently.

## Deferred and review policy

Defer native mobile apps, multi-forge ingestion, enterprise productivity scoring, a custom virtual city, arbitrary-query analytics, and new trophy economies. Evaluate STL export or MCP only after a user/consumer validates the need. Private repository ingestion requires a separate product decision.

Review after each milestone and monthly thereafter. Update issue state, benchmark date, observed metrics, experiment decisions, and this document together. Keep existing score defaults until a versioned change is evaluated. No notifications, outreach, production rollout, or pilot enrollment were performed by creating this roadmap.
