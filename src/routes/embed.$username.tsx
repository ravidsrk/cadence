import { createFileRoute, redirect } from "@tanstack/react-router";
import { EmbedView } from "@/components/dashboard/embed-view";
import { parseYearParam } from "@/lib/github/http";
import { loadCalendarOnly, todayIso } from "@/lib/github/load";
import { cadenceError, isGithubFnError } from "@/lib/github/types";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/embed/$username")({
  validateSearch: (search: Record<string, unknown>) => ({
    y:
      typeof search.y === "number"
        ? parseYearParam(String(search.y))
        : typeof search.y === "string"
          ? parseYearParam(search.y)
          : undefined,
    view:
      search.view === "3d" || search.view === "2d"
        ? (search.view as "3d" | "2d")
        : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (params.username === "$username" || params.username === ":username") {
      throw redirect({
        to: "/embed/$username",
        params: { username: "ravidsrk" },
        search,
        replace: true,
      });
    }
  },
  loaderDeps: ({ search }) => ({ y: search.y }),
  loader: async ({ params, deps }) => {
    const username = normalizeUsername(params.username);
    if (!username) {
      return {
        calendar: cadenceError("Invalid GitHub username."),
        year: deps.y,
      };
    }
    try {
      const calendar = await loadCalendarOnly({
        username,
        today: todayIso(),
        year: deps.y,
      });
      return { calendar, year: deps.y };
    } catch {
      return {
        calendar: cadenceError("Could not load the contribution calendar."),
        year: deps.y,
      };
    }
  },
  component: EmbedPage,
});

function EmbedPage() {
  const { calendar, year } = Route.useLoaderData();
  const { view } = Route.useSearch();
  if (isGithubFnError(calendar)) {
    return (
      <div className="bg-background p-4 text-sm text-muted-foreground">
        {calendar.error}
      </div>
    );
  }
  return <EmbedView calendar={calendar} year={year} initialView={view} />;
}
