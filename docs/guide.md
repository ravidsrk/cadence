# Using Cadence

Cadence is a read-only dashboard of public GitHub activity. It is not GitHub, not a score, and not a view into private repositories.

## Look up a profile

Type a GitHub username, or paste a profile URL like `github.com/gaearon`. Load takes you to `https://git-cadence.grok.me/u/{username}` with today selected.

On the home page, the last username you loaded is remembered in this browser only. Featured handles under the search field are known-good public calendars.

A 404 means GitHub has no public user with that login. Rate-limit messages mean GitHub asked Cadence to wait — the heatmap may still work.

## The selected day

Click a heatmap square, use **Pick day**, or pass `?d=YYYY-MM-DD` on a profile URL. Future dates are ignored.

| Number | Meaning |
| --- | --- |
| **Public commits** | Commits GitHub search reports as authored by that login on that UTC calendar day, on public default branches. Cadence lists up to the first 100. |
| **GitHub contributions** | The number on that square of GitHub’s contribution graph: commits, pull requests, reviews, and issues, including private work GitHub is allowed to count. |

These two numbers often disagree. A green square with an empty log is normal: private repos, issues, reviews, and pull requests still count as contributions.

## Year map

The year map is GitHub’s contribution calendar, clipped to today. **Last 12 months** is the default. Switch to a calendar year with the year chips.

- Square darkness is relative to that user in the selected range, not GitHub’s global 0–4 scale.
- Empty days stay empty. The darkest squares are the top quartile of that user’s non-zero days.
- Selecting a year that does not contain the current day jumps the selection to 31 Dec of that year, or to today for the current year.

## Sharing

Profile URLs are safe to send. They only encode a public username and optional date or year.

- [git-cadence.grok.me/u/ravidsrk](https://git-cadence.grok.me/u/ravidsrk) — that user’s last 12 months, today selected
- [git-cadence.grok.me/u/ravidsrk?d=2026-09-10](https://git-cadence.grok.me/u/ravidsrk?d=2026-09-10) — same profile, that day selected
- [git-cadence.grok.me/u/ravidsrk?y=2025](https://git-cadence.grok.me/u/ravidsrk?y=2025) — calendar year 2025
- [git-cadence.grok.me/u/ravidsrk/2025](https://git-cadence.grok.me/u/ravidsrk/2025) — year recap
- [git-cadence.grok.me/compare/gaearon/yyx990803](https://git-cadence.grok.me/compare/gaearon/yyx990803) — two calendars
- [git-cadence.grok.me/compare/gaearon/yyx990803?y=2025](https://git-cadence.grok.me/compare/gaearon/yyx990803?y=2025) — the same pair for 2025
- [git-cadence.grok.me/board](https://git-cadence.grok.me/board) — biggest single day on the board
- [git-cadence.grok.me/board?d=2026-09-14](https://git-cadence.grok.me/board?d=2026-09-14) — that calendar day only

**Copy link** writes the current profile, day, and year to the clipboard. **Share** opens X, plus card / heatmap / CSV / badge / embed. Recap and Compare sit next to the loaded profile.

Use ← → to move the selected day. Home and End jump to the ends of the range.

