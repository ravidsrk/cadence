# FAQ

### Why don’t the two day counts match?

Contributions include pull requests, reviews, issues, and private work GitHub counts. Public commits are only authored commits on public default branches that search returned for that UTC day.

### The square is green but the log is empty.

That usually means the contributions were private, or they were not commits (reviews, issues, pull requests). Cadence still shows the contribution count.

### Can I connect my GitHub account?

No. Cadence is public-only on purpose. Connecting an account would imply private data, and this product does not show that.

### Who can see a permalink I send?

Anyone with the URL. It is the same public graph GitHub already shows. Do not share a link if you do not want that day’s public commits forwarded.

### Is this an official GitHub product?

No. Cadence is an independent dashboard that reads public GitHub pages and APIs. Counts can lag or differ when GitHub changes those surfaces.

### Why does Cadence say it is rate-limited?

GitHub caps unauthenticated API traffic. Wait a minute and try again. The heatmap can still load when commit search is limited.

### Can I put Cadence on my GitHub README?

Yes. Export copies a badge:

```md
[![Cadence](https://git-cadence.grok.me/api/badge/USERNAME.svg)](https://git-cadence.grok.me/u/USERNAME)
```

Heatmap SVG and a JSON calendar live under `/api/heatmap/USERNAME.svg` and `/api/calendar/USERNAME`. Embed with `/embed/USERNAME`.

### What is a year recap?

`/u/USERNAME/2025` is that calendar year: map, weekday rhythm, pauses, public repo languages, and public search totals for commits vs pull requests. Languages are the primary language on recently pushed public repos, not commit volume.

### How does Compare work?

`/compare/USER_A/USER_B` loads two public calendars. Add `?y=2025` for a calendar year. The strip on top names who leads on volume, streak, and consistency. From a profile, Compare prefills that username.

### Is the shipping board a ranking of all of GitHub?

No. It is an opt-in list, capped at 24 public profiles, ranked by last-12-month streak or consistency. Cadence is not a score. Anyone can add a public handle; there are no Cadence accounts.
