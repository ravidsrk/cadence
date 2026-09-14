import { createFileRoute } from "@tanstack/react-router";
import { CompareView } from "@/components/dashboard/compare-view";
import { cadenceError } from "@/lib/github/types";
import { loadCalendarOnly, todayIso } from "@/lib/github/load";
import { SITE_ORIGIN } from "@/lib/site";
import { validateComparePairSearch } from "@/lib/github/search";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/compare/$a/$b")({
  validateSearch: (search: Record<string, unknown>) =>
    validateComparePairSearch(search),
  loaderDeps: ({ search }) => ({ y: search.y }),
  loader: async ({ params, deps }) => {
    const today = todayIso();
    const a = normalizeUsername(params.a);
    const b = normalizeUsername(params.b);
    if (!a || !b) {
      const invalid = cadenceError("Enter two valid GitHub usernames.");
      return { a: params.a, b: params.b, left: invalid, right: invalid, year: deps.y };
    }
    const [left, right] = await Promise.all([
      loadCalendarOnly({ username: a, today, year: deps.y }),
      loadCalendarOnly({ username: b, today, year: deps.y }),
    ]);
    return { a, b, left, right, year: deps.y };
  },
  head: ({ params, loaderData }) => {
    const year = loaderData?.year;
    const range = year ? String(year) : "last 12 months";
    return {
      meta: [
        { title: `${params.a} vs ${params.b} · Cadence` },
        {
          name: "description",
          content: `Public GitHub cadence compared: ${params.a} and ${params.b}, ${range}.`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href: `${SITE_ORIGIN}/compare/${encodeURIComponent(params.a)}/${encodeURIComponent(params.b)}${year ? `?y=${year}` : ""}`,
        },
      ],
    };
  },
  component: ComparePage,
});

function ComparePage() {
  const data = Route.useLoaderData();
  return (
    <CompareView
      a={data.a}
      b={data.b}
      left={data.left}
      right={data.right}
      year={data.year}
    />
  );
}
