import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/dashboard/landing-page";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/")({
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
  return <LandingPage />;
}
