import { createFileRoute } from "@tanstack/react-router";
import { CadenceApp, DEFAULT_USER } from "@/components/dashboard/cadence-app";
import { loadCadence, todayIso } from "@/lib/github/load";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: async () => {
    const today = todayIso();
    return loadCadence({ username: DEFAULT_USER, today, date: today });
  },
  head: () => ({
    meta: [
      { title: SITE_NAME },
      { name: "description", content: SITE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_ORIGIN }],
  }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <CadenceApp initial={initial} />;
}
