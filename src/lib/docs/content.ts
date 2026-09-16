import { SITE_ORIGIN } from "@/lib/site";

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; text: string }
  | { type: "dl"; items: { term: string; def: string }[] };

export type DocSection = {
  id: string;
  title: string;
  blocks: DocBlock[];
};

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    blocks: [
      {
        type: "p",
        text: "Cadence is a public GitHub shipping calendar. Look up any user, click a day, and share a permalink. It is read-only. There are no accounts.",
      },
      {
        type: "p",
        text: "It is not GitHub, not a score, and not a view into private repositories. Green squares can still include private work; the commit log never does.",
      },
      {
        type: "ul",
        items: [
          "Home opens on a default public profile.",
          `Every public GitHub user has a shareable page at ${SITE_ORIGIN}/u/{username}.`,
          "Copy link from the header. Share opens X plus card, badge, and export.",
          "Recap and Compare sit next to the profile, not in the header.",
          "Compare two users with a year toggle, or open a year recap at /u/{username}/{year}.",
          "The shipping board is an opt-in list of public handles, ranked by streak and consistency — not a score.",
        ],
      },
    ],
  },
  {
    id: "lookup",
    title: "Look up a profile",
    blocks: [
      {
        type: "p",
        text: "Type a GitHub username, or paste a profile URL like github.com/gaearon. Cadence strips the host and loads the public graph.",
      },
      {
        type: "ul",
        items: [
          "Load takes you to /u/{username} with today selected.",
          "On the home page, the last username you loaded is remembered in this browser only.",
          "Try the featured handles under the search field for a known-good public calendar.",
        ],
      },
      {
        type: "callout",
        text: "A 404 means GitHub has no public user with that login. Rate-limit messages mean GitHub asked Cadence to wait — the heatmap may still work.",
      },
    ],
  },
  {
    id: "day",
    title: "The selected day",
    blocks: [
      {
        type: "p",
        text: "Click a heatmap square, use Pick day, or pass ?d=YYYY-MM-DD on a profile URL. Future dates are ignored.",
      },
      {
        type: "dl",
        items: [
          {
            term: "Public commits",
            def: "Commits GitHub search reports as authored by that login on that UTC calendar day, on public default branches. Cadence lists up to the first 100.",
          },
          {
            term: "GitHub contributions",
            def: "The number on that square of GitHub’s contribution graph: commits, pull requests, reviews, and issues, including private work GitHub is allowed to count.",
          },
        ],
      },
      {
        type: "callout",
        text: "These two numbers often disagree. A green square with an empty log is normal: private repos, issues, reviews, and pull requests still count as contributions.",
      },
    ],
  },
  {
    id: "map",
    title: "Year map",
    blocks: [
      {
        type: "p",
        text: "The year map is GitHub’s contribution calendar, clipped to today. Last 12 months is the default. Switch to a calendar year with the year chips.",
      },
      {
        type: "ul",
        items: [
          "Square darkness is relative to that user in the selected range, not GitHub’s global 0–4 scale.",
          "Empty days stay empty. The darkest squares are the top quartile of that user’s non-zero days.",
          "Selecting a year that does not contain the current day jumps the selection to 31 Dec of that year, or to today for the current year.",
        ],
      },
    ],
  },
  {
    id: "metrics",
    title: "Metrics",
    blocks: [
      {
        type: "dl",
        items: [
          {
            term: "Today",
            def: "Contribution count on today’s GitHub calendar day.",
          },
          {
            term: "Streak",
            def: "Consecutive days with at least one contribution, ending today. If today is empty, the run is allowed to end yesterday.",
          },
          {
            term: "Longest",
            def: "The longest consecutive contribution run inside the selected range.",
          },
          {
            term: "Best day",
            def: "The day in range with the highest contribution count.",
          },
          {
            term: "Weekday rhythm",
            def: "Contribution totals grouped by weekday of the GitHub calendar date. The busiest weekday is called out.",
          },
          {
            term: "Consistency",
            def: "Share of days in range with at least one contribution.",
          },
          {
            term: "Shipping days",
            def: "Active days over days in range.",
          },
          {
            term: "Typical day",
            def: "Average contributions on days that were not empty.",
          },
          {
            term: "This week",
            def: "Contributions in the seven days ending today.",
          },
          {
            term: "Last 14 days",
            def: "Contribution volume for the two weeks ending on the selected day.",
          },
          {
            term: "Hour strip",
            def: "When public commits that day were authored, in your browser’s local time.",
          },
          {
            term: "Repo mix",
            def: "Public repositories that received those commits, capped at the busiest few.",
          },
          {
            term: "Longest pause",
            def: "Longest run of empty contribution days inside the selected range.",
          },
          {
            term: "Current pause",
            def: "Consecutive empty days ending today. Zero if today has a contribution.",
          },
          {
            term: "Quietest month",
            def: "Month in range with the fewest active days, ignoring stubs shorter than two weeks.",
          },
        ],
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing",
    blocks: [
      {
        type: "p",
        text: "Profile URLs are safe to send. They only encode a public username and optional date or year. Nothing private is in the link.",
      },
      {
        type: "ul",
        items: [
          `${SITE_ORIGIN}/u/ravidsrk — that user’s last 12 months, today selected.`,
          `${SITE_ORIGIN}/u/ravidsrk?d=2026-09-10 — same profile, that day selected.`,
          `${SITE_ORIGIN}/u/ravidsrk?y=2025 — calendar year 2025.`,
          `${SITE_ORIGIN}/u/ravidsrk/2025 — year recap for 2025.`,
          `${SITE_ORIGIN}/compare/gaearon/yyx990803 — two calendars side by side.`,
          `${SITE_ORIGIN}/compare/gaearon/yyx990803?y=2025 — the same pair for calendar year 2025.`,
          "Copy link writes the current profile, day, and year to the clipboard.",
          "Share copies export items and opens an X compose window with streak, range total, and the permalink.",
        ],
      },
    ],
  },
  {
    id: "export",
    title: "Export, badge, embed, API",
    blocks: [
      {
        type: "p",
        text: "Share is on a loaded profile. It covers X, the share card, heatmap, CSV, README badge, and embed. All of these are the same public calendar Cadence already shows.",
      },
      {
        type: "ul",
        items: [
          "Share card downloads an SVG or PNG with name, streak, totals, and the heatmap.",
          `README badge: ${SITE_ORIGIN}/api/badge/{username}.svg — streak, today, and range total.`,
          `Heatmap SVG: ${SITE_ORIGIN}/api/heatmap/{username}.svg?year=2025`,
          `JSON calendar: ${SITE_ORIGIN}/api/calendar/{username}`,
          `Embed: iframe ${SITE_ORIGIN}/embed/{username} (optional ?y=2025).`,
          "CSV and JSON downloads are the day rows for the selected range.",
        ],
      },
      {
        type: "callout",
        text: "GitHub README image cache can lag a few minutes. The badge is public data with a short cache.",
      },
    ],
  },
  {
    id: "recap",
    title: "Year recap and compare",
    blocks: [
      {
        type: "p",
        text: "Recap is a calendar year: map, weekday rhythm, pauses, public repo languages, and GitHub search totals for commits vs pull requests. Languages are primary language on recently pushed public repos the user owns — not commit volume.",
      },
      {
        type: "p",
        text: "Compare loads two calendars. Switch Last 12 months or a calendar year; the strip on top names who leads on volume, streak, and consistency. Two heatmap fetches, so GitHub may rate-limit if you hammer it.",
      },
    ],
  },
  {
    id: "board",
    title: "Shipping board",
    blocks: [
      {
        type: "p",
        text: "The board is an opt-in list of public GitHub profiles. Cadence ranks them by last-12-month streak, consistency, active days, or volume. It is not a productivity score and not every GitHub user — only handles someone added, capped at 24 so GitHub is not crawled.",
      },
      {
        type: "ul",
        items: [
          `${SITE_ORIGIN}/board — default sort is current streak.`,
          `${SITE_ORIGIN}/board?s=consistency — share of days with at least one contribution.`,
          "Add a username on the board, or Add to board from a loaded profile.",
          "Anyone can add a public handle. There are no Cadence accounts.",
        ],
      },
      {
        type: "callout",
        text: "Volume still includes private work GitHub counts on the contribution graph. Streak and consistency use that same graph.",
      },
    ],
  },
  {
    id: "keyboard",
    title: "Keyboard",
    blocks: [
      {
        type: "ul",
        items: [
          "← and → move the selected day along the calendar.",
          "Home jumps to the first day in range. End jumps to the last.",
          "Keys are ignored while typing in the username field.",
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data and privacy",
    blocks: [
      {
        type: "p",
        text: "Cadence only reads public GitHub data. It does not sign in as you, store profiles on a server, or write anything back to GitHub.",
      },
      {
        type: "ul",
        items: [
          "Profile: GitHub users API.",
          "Heatmap: GitHub’s public contribution calendar HTML, with a public JSON mirror as fallback.",
          "Commit log: GitHub commit search for author:{login} author-date:{day}.",
          "Lookups are cached for a few minutes so repeat views of the same user and day stay snappy.",
        ],
      },
      {
        type: "h3",
        text: "What stays in this browser",
      },
      {
        type: "p",
        text: "On the home page only, the last username you loaded is saved in localStorage so a refresh can reopen it. Profile URLs do not need that. Clear site data and it is gone.",
      },
      {
        type: "h3",
        text: "Time zones",
      },
      {
        type: "p",
        text: "Heatmap days follow GitHub’s contribution calendar. Commit search uses GitHub’s author-date as a UTC calendar day. A commit near midnight can land on different days in the two views. The hour strip converts authored timestamps to your local clock.",
      },
    ],
  },
  {
    id: "limits",
    title: "Limits",
    blocks: [
      {
        type: "ul",
        items: [
          "Private repositories never appear in the commit log, even when they shade the heatmap.",
          "Commit search can mark results incomplete, and Cadence only lists the first 100 public commits for a day.",
          "GitHub rate limits unauthenticated traffic. If search is limited, the heatmap still tries to load.",
          "Forks, bots, and unusual author emails can make search miss commits you still see on GitHub.",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    blocks: [
      {
        type: "h3",
        text: "Why don’t the two day counts match?",
      },
      {
        type: "p",
        text: "Contributions include pull requests, reviews, issues, and private work GitHub counts. Public commits are only authored commits on public default branches that search returned for that UTC day.",
      },
      {
        type: "h3",
        text: "The square is green but the log is empty.",
      },
      {
        type: "p",
        text: "That usually means the contributions were private, or they were not commits (reviews, issues, pull requests). Cadence still shows the contribution count.",
      },
      {
        type: "h3",
        text: "Can I connect my GitHub account?",
      },
      {
        type: "p",
        text: "No. Cadence is public-only on purpose. Connecting an account would imply private data, and this product does not show that.",
      },
      {
        type: "h3",
        text: "Who can see a permalink I send?",
      },
      {
        type: "p",
        text: "Anyone with the URL. It is the same public graph GitHub already shows. Do not share a link if you do not want that day’s public commits forwarded.",
      },
      {
        type: "h3",
        text: "Is this an official GitHub product?",
      },
      {
        type: "p",
        text: "No. Cadence is an independent dashboard that reads public GitHub pages and APIs. Counts can lag or differ when GitHub changes those surfaces.",
      },
    ],
  },
];
