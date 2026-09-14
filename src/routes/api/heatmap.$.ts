import { createFileRoute } from "@tanstack/react-router";
import { parseYearParam, svgResponse } from "@/lib/github/http";
import { todayIso } from "@/lib/github/load";
import { isGithubFnError } from "@/lib/github/types";
import { usernameFromSvgSplat } from "@/lib/github/username";

export const Route = createFileRoute("/api/heatmap/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const username = usernameFromSvgSplat(params._splat);
        if (!username) {
          return new Response("Invalid username", { status: 400 });
        }
        const year = parseYearParam(new URL(request.url).searchParams.get("year"));
        const { fetchCalendar } = await import("@/lib/github/fetch.server");
        const { heatmapSvg } = await import("@/lib/github/svg");
        const calendar = await fetchCalendar({
          username,
          today: todayIso(),
          year,
        });
        if (isGithubFnError(calendar)) {
          return new Response(calendar.error, {
            status: calendar.code === "not_found" ? 404 : 429,
          });
        }
        return svgResponse(heatmapSvg(calendar.days));
      },
    },
  },
});
