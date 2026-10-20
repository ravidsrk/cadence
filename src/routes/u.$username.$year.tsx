import { createFileRoute, redirect } from "@tanstack/react-router";
import { RecapView } from "@/components/dashboard/recap-view";
import { cadenceError } from "@/lib/github/types";
import { loadRecap, todayIso } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import {
  isReservedRoute,
  normalizeUsername,
  recapPath,
} from "@/lib/github/username";

export const Route = createFileRoute("/u/$username/$year")({
  beforeLoad: ({ params }) => {
    if (
      params.username === "$username" ||
      params.username === ":username" ||
      params.year === "$year" ||
      params.year === ":year"
    ) {
      const targetUser =
        params.username === "$username" || params.username === ":username"
          ? "ravidsrk"
          : params.username;
      const targetYear =
        params.year === "$year" || params.year === ":year"
          ? String(new Date().getUTCFullYear())
          : params.year;
      throw redirect({
        to: isReservedRoute(targetUser) ? "/u/$username/$year" : "/$username/$year",
        params: {
          username: targetUser,
          year: targetYear,
        },
        replace: true,
      });
    }
    if (!isReservedRoute(params.username)) {
      const normalized =
        normalizeUsername(params.username)?.toLowerCase() ?? params.username;
      throw redirect({
        to: "/$username/$year",
        params: { username: normalized, year: params.year },
        statusCode: 308,
        replace: true,
      });
    }
  },
  loader: async ({ params }) => {
    const today = todayIso();
    const todayYear = Number(today.slice(0, 4));
    const username = normalizeUsername(params.username);
    const year = Number(params.year);
    if (!username || !Number.isInteger(year) || year < 2008 || year > todayYear) {
      return {
        today,
        username: params.username,
        year: Number.isInteger(year) ? year : todayYear,
        calendar: cadenceError("That recap URL is not valid."),
        languages: cadenceError("That recap URL is not valid."),
        split: cadenceError("That recap URL is not valid."),
      };
    }
    return loadRecap({ username, today, year });
  },
  head: ({ params, loaderData }) => {
    const name = params.username;
    const year = params.year;
    const title = `${name} · ${year} recap · Cadence`;
    const description = loaderData
      ? `Public GitHub recap for ${name} in ${year}.`
      : `Cadence year recap for ${name}.`;
    const canonical = `${SITE_ORIGIN}${recapPath(params.username, params.year)}`;
    const cardImage = `${SITE_ORIGIN}/api/card/${encodeURIComponent(params.username)}.svg?year=${encodeURIComponent(params.year)}`;
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
      links: [
        {
          rel: "canonical",
          href: canonical,
        },
      ],
    };
  },
  component: RecapPage,
});

function RecapPage() {
  const data = Route.useLoaderData();
  return <RecapView data={data} />;
}
