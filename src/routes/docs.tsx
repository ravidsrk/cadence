import { createFileRoute } from "@tanstack/react-router";
import { DocsPage } from "@/components/docs/docs-page";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs · Cadence" },
      {
        name: "description",
        content:
          "How Cadence works: lookup, heatmap, commits versus contributions, sharing, and data sources.",
      },
    ],
  }),
  component: DocsPage,
});
