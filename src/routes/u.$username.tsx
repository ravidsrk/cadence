import { createFileRoute } from "@tanstack/react-router";
import { CadenceApp } from "@/components/dashboard/cadence-app";
import { cadenceError, isGithubFnError } from "@/lib/github/types";
import { loadCadence, todayIso } from "@/lib/github/load";
import { validateCadenceSearch } from "@/lib/github/search";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/u/$username")({
  validateSearch: (search: Record<string, unknown>) =>
    validateCadenceSearch(search),
  loaderDeps: ({ search }) => ({ d: search.d, y: search.y }),
  loader: async ({ params, deps }) => {
    const today = todayIso();
    const username = normalizeUsername(params.username);
    if (!username) {
      const invalid = cadenceError("That is not a valid GitHub username.");
      return {
        today,
        username: params.username,
        calendar: invalid,
        commits: invalid,
      };
    }
    const date =
      deps.d && deps.d <= today && /^\d{4}-\d{2}-\d{2}$/.test(deps.d)
        ? deps.d
        : today;
    let year = deps.y;
    if (year && Number(date.slice(0, 4)) !== year) {
      year = Number(date.slice(0, 4));
    }
    return loadCadence({ username, today, date, year });
  },
  head: ({ params, loaderData }) => {
    const calendar = loaderData?.calendar;
    const profile =
      calendar && !isGithubFnError(calendar) ? calendar.profile : null;
    const name = profile?.name || profile?.login || params.username;
    const streak =
      calendar && !isGithubFnError(calendar)
        ? calendar.stats.currentStreak
        : null;
    const description =
      streak != null
        ? `${name}'s public GitHub cadence — ${streak}-day streak.`
        : `Public GitHub shipping cadence for ${name}.`;
    return {
      meta: [
        { title: `${name} · Cadence` },
        { name: "description", content: description },
      ],
    };
  },
  component: Profile,
});

function Profile() {
  const initial = Route.useLoaderData();
  const { username } = Route.useParams();
  const search = Route.useSearch();
  return (
    <CadenceApp
      initial={initial}
      routeUsername={normalizeUsername(username) ?? username}
      dateFromUrl={search?.d}
      yearFromUrl={search?.y}
    />
  );
}
