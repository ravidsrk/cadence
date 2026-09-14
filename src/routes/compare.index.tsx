import { createFileRoute, Link } from "@tanstack/react-router";
import { CompareForm } from "@/components/dashboard/compare-view";
import { validateCompareHomeSearch } from "@/lib/github/search";

export const Route = createFileRoute("/compare/")({
  validateSearch: (search: Record<string, unknown>) =>
    validateCompareHomeSearch(search),
  head: () => ({
    meta: [
      { title: "Compare · Cadence" },
      {
        name: "description",
        content: "Compare two public GitHub shipping calendars side by side.",
      },
    ],
  }),
  component: CompareHome,
});

function CompareHome() {
  const search = Route.useSearch();
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Compare
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Two public calendars
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Streak, volume, consistency, and the year map — still public data
            only.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Back to dashboard
        </Link>
      </header>
      <CompareForm leftDefault={search.a ?? ""} />
    </div>
  );
}
