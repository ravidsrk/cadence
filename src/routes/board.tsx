import { createFileRoute } from "@tanstack/react-router";
import { BoardView } from "@/components/dashboard/board-view";
import { parseBoardSort } from "@/lib/github/board";
import { loadBoardPage } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/board")({
  validateSearch: (search: Record<string, unknown>) => {
    const s = parseBoardSort(search.s);
    const d =
      typeof search.d === "string" && DATE_RE.test(search.d)
        ? search.d
        : undefined;
    if (d) return { d };
    if (s !== "peak") return { s };
    return {};
  },
  loader: async () => loadBoardPage(),
  head: () => ({
    meta: [
      { title: "Biggest day · Cadence" },
      {
        name: "description",
        content:
          "Who on the Cadence board had the most GitHub contributions in a single day.",
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
      sort={search.s}
      date={date}
      today={data.today}
    />
  );
}
