import { createFileRoute } from "@tanstack/react-router";
import { CadenceApp, DEFAULT_USER } from "@/components/dashboard/cadence-app";
import { loadCadence, todayIso } from "@/lib/github/load";

export const Route = createFileRoute("/")({
  loader: async () => {
    const today = todayIso();
    return loadCadence({ username: DEFAULT_USER, today, date: today });
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <CadenceApp initial={initial} />;
}
