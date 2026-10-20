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
        text: "Cadence is a visual-first GitHub shipping intelligence dashboard. Look up any builder, inspect their 3D isometric contribution skyline, evaluate their 4-Pillar Cadence Score (0–100), and compare head-to-head rivalries. It is 100% read-only with zero sign-in required.",
      },
      {
        type: "ul",
        items: [
          `Every public GitHub builder has a shareable 3D dashboard at ${SITE_ORIGIN}/{username}.`,
          "Press ⌘K (or Ctrl+K) from anywhere to open Quick Jump — type @username to inspect a builder or userA vs userB for an instant head-to-head comparison.",
          "Switch seamlessly between the 3D Isometric Skyline, 2D Heatmap, or Split view.",
          "Compare two builders side-by-side at /compare/{a}/{b} or open a full-year shipping recap at /{username}/{year}.",
          "Compete on the multi-dimensional Leaderboard (/board) across Rolling Time Horizons (7D, 30D, 90D, 12M), Competitive League Tiers, and Ecosystem Language Cohort Leagues.",
        ],
      },
    ],
  },
  {
    id: "score",
    title: "4-Pillar Cadence Score & Tiers",
    blocks: [
      {
        type: "p",
        text: "Instead of ranking builders by raw single-day commit spikes, Cadence computes a balanced 0–100 Composite Cadence Score across four weighted pillars:",
      },
      {
        type: "dl",
        items: [
          {
            term: "Consistency (35 pts)",
            def: "Active shipping days divided by total days in the selected window. Rewards builders who show up reliably all year.",
          },
          {
            term: "Streak Mastery (25 pts)",
            def: "Blends longest consecutive contribution run (up to 15 pts, saturating at 60d) and live active streak (up to 10 pts, saturating at 30d).",
          },
          {
            term: "Momentum (20 pts)",
            def: "Compares recent 30-day shipping velocity against the builder's 365-day baseline, plus active days in the last 7 days.",
          },
          {
            term: "Volume (20 pts)",
            def: "Log-damped total contributions (up to 12 pts) and log-damped peak day (up to 8 pts) so automated commit floods cannot game the board.",
          },
        ],
      },
      {
        type: "h3",
        text: "Competitive League Tiers & Builder Archetypes",
      },
      {
        type: "ul",
        items: [
          "Apex Tier (85–100): Elite daily rhythm, sustained streak mastery, and top-decile output.",
          "Diamond Tier (70–84): High-consistency shipper with strong active momentum.",
          "Gold Tier (55–69): Reliable multi-week builder with solid shipping cadence.",
          "Silver Tier (40–54): Regular contributor building long-term momentum.",
          "Bronze Tier (0–39): Emerging cadence or focused burst shipper.",
          "Builder Archetypes: Every profile is classified into Relentless, Surging, Marathon, Heavy, Striker, or Steady based on shipping rhythm.",
        ],
      },
    ],
  },
  {
    id: "skyline",
    title: "3D Skyline & Year Map",
    blocks: [
      {
        type: "p",
        text: "The 3D Skyline renders every week and day of your contribution calendar as an interactive isometric city. Extruded towers scale with daily output and glow on peak shipping days.",
      },
      {
        type: "ul",
        items: [
          "Drag to orbit, use the tilt/rotate/zoom sliders, or tap a preset camera angle (Iso, Top, Front).",
          "Press Play to watch a chronological week-by-week time-lapse of the year unfolding.",
          "Square darkness and tower height are calibrated relative to that builder's own quartiles in the selected range.",
          "Click any 3D tower or 2D square to inspect that day's commit split (public vs private) and merged pull requests.",
        ],
      },
    ],
  },
  {
    id: "board",
    title: "Leaderboard, Cohorts & treg Discovery",
    blocks: [
      {
        type: "p",
        text: "The Competitive Leaderboard (/board) ranks public builders by Composite Cadence Score, Consistency %, Active Streak, Volume, or Single-Day Peak.",
      },
      {
        type: "dl",
        items: [
          {
            term: "Rolling Time Horizons",
            def: "Switch between 7D Sprint, 30D Monthly, 90D Quarter, and 12M Annual windows. Every pillar, streak, and 12-week trajectory ribbon recomputes dynamically.",
          },
          {
            term: "Language Cohort Leagues",
            def: "Filter the arena by ecosystem: Global Open, TypeScript, Python, Rust, or Go.",
          },
          {
            term: "Trending Builders & Repos",
            def: "Powered by treg live GitHub Trending discovery, inspect breakout developers and hottest repositories (Today / This Week / This Month) and draft them onto the board in one tap.",
          },
          {
            term: "Shipped Portfolio & Stack",
            def: "Every profile and leaderboard drawer surfaces the builder's top public repositories, star velocity, fork counts, and primary language stack.",
          },
        ],
      },
    ],
  },
  {
    id: "metrics",
    title: "Visual Metrics",
    blocks: [
      {
        type: "dl",
        items: [
          {
            term: "Today",
            def: "Contribution count on today’s GitHub calendar day.",
          },
          {
            term: "Streak & Barcode",
            def: "Consecutive days with at least one contribution, ending today (or yesterday if today is still empty), paired with a 365-day visual streak barcode.",
          },
          {
            term: "Consistency Ring",
            def: "Radial progress ring showing active shipping days over total days in range, plus intensity tier distribution (L1–L4).",
          },
          {
            term: "Monthly Momentum",
            def: "12-month bar chart highlighting seasonal shipping peaks and quiet periods.",
          },
          {
            term: "Weekday Rhythm",
            def: "Contribution totals grouped by day of the week (Sun–Sat), calling out your peak shipping weekday.",
          },
          {
            term: "Language Donut",
            def: "Primary language distribution across the builder's top public repositories.",
          },
        ],
      },
    ],
  },
  {
    id: "export",
    title: "Embeds, Badges, SVG & API",
    blocks: [
      {
        type: "p",
        text: "Every profile includes one-click exports for GitHub READMEs, personal sites, and social sharing:",
      },
      {
        type: "ul",
        items: [
          `3D Skyline SVG: ${SITE_ORIGIN}/api/heatmap/{username}.svg?view=3d — live isometric SVG ready for GitHub READMEs.`,
          `2D Heatmap SVG: ${SITE_ORIGIN}/api/heatmap/{username}.svg — classic calendar grid SVG (optional ?year=2025).`,
          `Compact Streak Badge: ${SITE_ORIGIN}/api/badge/{username}.svg — live shield with current streak, today's count, and annual total.`,
          `Interactive Iframe Embed: ${SITE_ORIGIN}/embed/{username} — interactive 3D/2D widget with League Tier and Cadence Score.`,
          `JSON Calendar API: ${SITE_ORIGIN}/api/calendar/{username} — structured day-by-day contribution payload.`,
          "High-res PNG & SVG Share Cards and raw CSV exports are available from the Export menu on any profile.",
        ],
      },
      {
        type: "callout",
        text: "Use the Interactive README & Embed Studio above to preview and copy Markdown or HTML snippets for any GitHub username.",
      },
    ],
  },
  {
    id: "keyboard",
    title: "Keyboard Shortcuts",
    blocks: [
      {
        type: "ul",
        items: [
          "⌘K or Ctrl+K opens the global Quick Jump command palette from any page.",
          "← and → move the selected day along the contribution calendar.",
          "Home jumps to the first day in range; End jumps to the most recent day.",
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data & Privacy",
    blocks: [
      {
        type: "p",
        text: "Cadence reads public GitHub data only. It never asks for OAuth tokens, never accesses private repositories, and stores custom board additions locally in your browser.",
      },
      {
        type: "ul",
        items: [
          "Contribution Calendar: GitHub’s public contribution calendar HTML with automatic JSON mirror fallback.",
          "Daily Commit & PR Split: GitHub REST search for author-date commits and merged pull requests on the selected UTC day.",
          "Live Discovery & Portfolio: Powered by treg providers with automatic GitHub REST/Trending fallback and server-side caching.",
        ],
      },
    ],
  },
];
