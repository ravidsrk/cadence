import { createFileRoute } from "@tanstack/react-router";
import { CompareView } from "@/components/dashboard/compare-view";
import { cadenceError } from "@/lib/github/types";
import { loadCalendarOnly, todayIso } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/compare/$a/$b")({
  loader: async ({ params }) => {
    const today = todayIso();
    const a = normalizeUsername(params.a);
    const b = normalizeUsername(params.b);
    if (!a || !b) {
      const invalid = cadenceError("Enter two valid GitHub usernames.");
      return { a: params.a, b: params.b, left: invalid, right: invalid };
    }
    const [left, right] = await Promise.all([
      loadCalendarOnly({ username: a, today }),
      loadCalendarOnly({ username: b, today }),
    ]);
    return { a, b, left, right };
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.a} vs ${params.b} · Cadence` },
      {
        name: "description",
        content: `Public GitHub cadence compared: ${params.a} and ${params.b}.`,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: `${SITE_ORIGIN}/compare/${encodeURIComponent(params.a)}/${encodeURIComponent(params.b)}`,
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const data = Route.useLoaderData();
  return (
    <CompareView a={data.a} b={data.b} left={data.left} right={data.right} />
  );
}
