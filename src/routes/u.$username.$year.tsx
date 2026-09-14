import { createFileRoute } from "@tanstack/react-router";
import { RecapView } from "@/components/dashboard/recap-view";
import { cadenceError } from "@/lib/github/types";
import { loadRecap, todayIso } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/u/$username/$year")({
  loader: async ({ params }) => {
    const today = todayIso();
    const username = normalizeUsername(params.username);
    const year = Number(params.year);
    if (!username || !Number.isInteger(year) || year < 2008 || year > 2100) {
      return {
        today,
        username: params.username,
        year: Number.isInteger(year) ? year : new Date().getFullYear(),
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
    return {
      meta: [
        { title: `${name} · ${year} recap · Cadence` },
        {
          name: "description",
          content: loaderData
            ? `Public GitHub recap for ${name} in ${year}.`
            : `Cadence year recap for ${name}.`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href: `${SITE_ORIGIN}/u/${encodeURIComponent(params.username)}/${encodeURIComponent(params.year)}`,
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
