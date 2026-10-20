import { createFileRoute } from "@tanstack/react-router";
import { apiErrorStatus, parseYearParam, svgResponse } from "@/lib/github/http";
import { todayIso } from "@/lib/github/load";
import { isGithubFnError } from "@/lib/github/types";
import { usernameFromSvgSplat } from "@/lib/github/username";

export const Route = createFileRoute("/api/card/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const username = usernameFromSvgSplat(params._splat);
        if (!username) {
          return new Response("Invalid username", {
            status: 400,
            headers: { "Cache-Control": "no-store" },
          });
        }
        const url = new URL(request.url);
        const year = parseYearParam(url.searchParams.get("year"));
        const view = url.searchParams.get("view") === "2d" ? "2d" : "3d";
        const { fetchCalendar } = await import("@/lib/github/fetch.server");
        const { shareCardSvg } = await import("@/lib/github/svg");
        const calendar = await fetchCalendar({
          username,
          today: todayIso(),
          year,
        });
        if (isGithubFnError(calendar)) {
          return new Response(calendar.error, {
            status: apiErrorStatus(calendar.code),
            headers: { "Cache-Control": "no-store" },
          });
        }
        return svgResponse(shareCardSvg(calendar, { view }));
      },
    },
  },
});
