import { createFileRoute } from "@tanstack/react-router";
import { EmbedView } from "@/components/dashboard/embed-view";
import { parseYearParam } from "@/lib/github/http";
import { loadCalendarOnly, todayIso } from "@/lib/github/load";
import { isGithubFnError } from "@/lib/github/types";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/embed/$username")({
  validateSearch: (search: Record<string, unknown>) => ({
    y:
      typeof search.y === "number"
        ? search.y
        : typeof search.y === "string"
          ? parseYearParam(search.y)
          : undefined,
  }),
  loaderDeps: ({ search }) => ({ y: search.y }),
  loader: async ({ params, deps }) => {
    const username = normalizeUsername(params.username) ?? params.username;
    const calendar = await loadCalendarOnly({
      username,
      today: todayIso(),
      year: deps.y,
    });
    return { calendar, year: deps.y };
  },
  component: EmbedPage,
});

function EmbedPage() {
  const { calendar, year } = Route.useLoaderData();
  if (isGithubFnError(calendar)) {
    return (
      <div className="bg-background p-4 text-sm text-muted-foreground">
        {calendar.error}
      </div>
    );
  }
  return <EmbedView calendar={calendar} year={year} />;
}
