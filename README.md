# Cadence

Public GitHub shipping calendar. Look up any user, click a day, share a permalink.

![Cadence dashboard](docs/screenshot.png)

Cadence reads the public contribution graph and public commit search. Click a square to see the commits authored that day, plus weekday rhythm, streak, and consistency.

## Features

- Look up any GitHub username (or paste a profile URL)
- Year heatmap with day drill-down
- Public commit log, hour-of-day strip, and repo mix for the selected day
- Current / longest streak, best day, weekday rhythm, consistency
- Shareable profiles at `/u/{username}` (optional `?d=YYYY-MM-DD` and `?y=YYYY`)
- Copy link or share to X

Private work can still fill heatmap squares without appearing in the commit log.

## Run locally

Needs Node 22.

```bash
git clone https://github.com/ravidsrk/cadence.git
cd cadence
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080). Profiles: [http://localhost:8080/u/ravidsrk](http://localhost:8080/u/ravidsrk).

Optional: set `GITHUB_TOKEN` (or `GH_TOKEN`) to raise GitHub API rate limits. Copy `.env.example` if you want a local file — this project reads the variable from the environment.

```bash
npm run typecheck
npm test
npm run build
```

## Stack

TanStack Start, React 19, Tailwind v4, TanStack Query, Recharts.

## License

MIT
