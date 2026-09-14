# Data and privacy

Cadence only reads public GitHub data. It does not sign in as you, store profiles on a server, or write anything back to GitHub.

## Sources

- **Profile** — GitHub users API
- **Heatmap** — GitHub’s public contribution calendar HTML, with a public JSON mirror as fallback
- **Commit log** — GitHub commit search for `author:{login} author-date:{day}`
- Lookups are cached for a few minutes so repeat views of the same user and day stay snappy

## What stays in this browser

On the home page only, the last username you loaded is saved in `localStorage` so a refresh can reopen it. Profile URLs do not need that. Clear site data and it is gone.

## Time zones

Heatmap days follow GitHub’s contribution calendar. Commit search uses GitHub’s `author-date` as a UTC calendar day. A commit near midnight can land on different days in the two views. The hour strip converts authored timestamps to your local clock.

## Limits

- Private repositories never appear in the commit log, even when they shade the heatmap.
- Commit search can mark results incomplete, and Cadence only lists the first 100 public commits for a day.
- GitHub rate limits unauthenticated traffic. If search is limited, the heatmap still tries to load.
- Forks, bots, and unusual author emails can make search miss commits you still see on GitHub.

Operators can set `GITHUB_TOKEN` (or `GH_TOKEN`) to raise GitHub rate limits. Cadence never asks a visitor for a token.
