import {
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router";
import {
  CadenceApp,
  ProfileNotFoundView,
  ProfilePageSkeleton,
} from "@/components/dashboard/cadence-app";
import { isGithubFnError } from "@/lib/github/types";
import { loadCadence, todayIso } from "@/lib/github/load";
import { validateCadenceSearch } from "@/lib/github/search";
import { SITE_ORIGIN } from "@/lib/site";
import {
  isReservedRoute,
  normalizeUsername,
  profilePath,
  resolveSelectedDate,
} from "@/lib/github/username";

export const Route = createFileRoute("/$username/")({
  validateSearch: (search: Record<string, unknown>) =>
    validateCadenceSearch(search),
  beforeLoad: ({ params, search }) => {
    if (params.username === "$username" || params.username === ":username") {
      throw redirect({
        to: "/$username",
        params: { username: "ravidsrk" },
        search,
        replace: true,
      });
    }
    if (isReservedRoute(params.username)) {
      throw redirect({
        to: "/u/$username",
        params: { username: params.username },
        search,
        statusCode: 308,
        replace: true,
      });
    }
  },
  loaderDeps: ({ search }) => ({
    d: search.d,
    range: search.range ?? search.y,
    view: search.view,
    skeleton: search.skeleton,
  }),
  loader: async ({ params, deps }) => {
    const today = todayIso();
    const username = normalizeUsername(params.username);
    if (!username) {
      throw notFound({ data: { username: params.username } });
    }
    const year = deps.range;
    const date = resolveSelectedDate(deps.d, year, today);
    let data;
    try {
      data = await loadCadence({ username, today, date, year });
    } catch {
      return {
        today,
        username,
        calendar: {
          error: "Could not load the contribution calendar.",
          code: "unavailable" as const,
        },
        commits: {
          error: "Could not load that day from GitHub.",
          code: "unavailable" as const,
        },
      };
    }
    if (
      isGithubFnError(data.calendar) &&
      data.calendar.code === "not_found"
    ) {
      throw notFound({ data: { username: params.username } });
    }
    if (
      !isGithubFnError(data.calendar) &&
      data.calendar.profile.login !== params.username &&
      !isReservedRoute(data.calendar.profile.login)
    ) {
      throw redirect({
        to: "/$username",
        params: { username: data.calendar.profile.login },
        search: {
          ...(deps.d ? { d: deps.d } : {}),
          ...(deps.range ? { range: deps.range } : {}),
          ...(deps.view ? { view: deps.view } : {}),
          ...(deps.skeleton ? { skeleton: deps.skeleton } : {}),
        },
        statusCode: 308,
        replace: true,
      });
    }
    return data;
  },
  pendingMs: 0,
  pendingComponent: ProfilePending,
  notFoundComponent: ProfileNotFound,
  head: ({ params, loaderData }) => {
    const calendar = loaderData?.calendar;
    const profile =
      calendar && !isGithubFnError(calendar) ? calendar.profile : null;
    const login = profile?.login ?? params.username;
    const displayTitle = profile
      ? profile.name
        ? `${profile.name} (@${profile.login})`
        : `@${profile.login}`
      : `@${params.username}`;
    const title = `${displayTitle} · Cadence`;
    const total =
      calendar && !isGithubFnError(calendar)
        ? calendar.stats.total.toLocaleString("en-US")
        : null;
    const streak =
      calendar && !isGithubFnError(calendar)
        ? calendar.stats.currentStreak
        : null;
    const rangeLabel =
      calendar &&
      !isGithubFnError(calendar) &&
      calendar.range.from.endsWith("-01-01") &&
      calendar.range.from.slice(0, 4) === calendar.range.to.slice(0, 4)
        ? calendar.range.from.slice(0, 4)
        : "last 12 months";
    const description =
      total != null && streak != null
        ? `${total} contributions in the ${rangeLabel} · ${streak}-day streak`
        : `Public GitHub shipping cadence for ${displayTitle}.`;
    const canonical = `${SITE_ORIGIN}${profilePath(login)}`;
    const cardImage = `${SITE_ORIGIN}/api/card/${encodeURIComponent(login)}.svg`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:image", content: cardImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: cardImage },
      ],
      links: [{ rel: "canonical", href: canonical }],
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
      yearFromUrl={search?.range ?? search?.y}
      viewFromUrl={search?.view}
      forceSkeleton={search?.skeleton === 1}
    />
  );
}

function ProfilePending() {
  const { username } = Route.useParams();
  return <ProfilePageSkeleton username={username} />;
}

function ProfileNotFound() {
  const { username } = Route.useParams();
  return <ProfileNotFoundView username={username} />;
}
