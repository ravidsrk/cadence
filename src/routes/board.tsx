import { createFileRoute } from "@tanstack/react-router";
import { BoardView } from "@/components/dashboard/board-view";
import { parseBoardSort } from "@/lib/github/board";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/board")({
  validateSearch: (search: Record<string, unknown>) => {
    const s = parseBoardSort(search.s);
    return s === "streak" ? {} : { s };
  },
  loader: async () => {
    const { loadBoard } = await import("@/lib/github/board.server");
    return loadBoard();
  },
  head: () => ({
    meta: [
      { title: "Board · Cadence" },
      {
        name: "description",
        content:
          "Public GitHub shipping board — streak and consistency, not a score.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/board` }],
  }),
  component: BoardPage,
});

function BoardPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <BoardView entries={data.entries} max={data.max} sort={search.s} />
  );
}
