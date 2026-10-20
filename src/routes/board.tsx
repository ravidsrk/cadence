import { createFileRoute } from "@tanstack/react-router";
import { BoardView } from "@/components/dashboard/board-view";
import {
  parseBoardSort,
  parseBoardWindow,
  type BoardSearch,
} from "@/lib/github/board";
import { loadBoardPage } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import { isValidIsoDate } from "@/lib/github/username";

export const Route = createFileRoute("/board")({
  validateSearch: (search: Record<string, unknown>): BoardSearch => {
    const s = parseBoardSort(search.s);
    const w = parseBoardWindow(search.w);
    const d =
      typeof search.d === "string" && isValidIsoDate(search.d)
        ? search.d
        : undefined;
    const out: BoardSearch = {};
    if (w !== "12m") out.w = w;
    if (d) {
      out.d = d;
      return out;
    }
    if (s !== "score" && s !== "day") out.s = s;
    return out;
  },
  loaderDeps: ({ search }) => ({ s: search.s, w: search.w }),
  loader: async ({ deps }) =>
    loadBoardPage({ sort: deps.s, window: deps.w }),
  head: () => ({
    meta: [
      { title: "Leaderboard · Cadence" },
      {
        name: "description",
        content:
          "Shipping leaderboard ranked by composite Cadence Score, consistency, streak, momentum, and volume across 7d, 30d, 90d, and 12m horizons.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/board` }],
  }),
  component: BoardPage,
});

function BoardPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const date =
    search.d && search.d <= data.today ? search.d : undefined;
  return (
    <BoardView
      entries={data.entries}
      max={data.max}
      total={data.total}
      hasMore={data.hasMore}
      indexer={data.indexer}
      sort={search.s}
      window={search.w}
      date={date}
      today={data.today}
    />
  );
}
