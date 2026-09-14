import { createFileRoute } from "@tanstack/react-router";
import { svgResponse } from "@/lib/github/http";
import { todayIso } from "@/lib/github/load";
import { isGithubFnError } from "@/lib/github/types";
import { usernameFromSvgSplat } from "@/lib/github/username";

export const Route = createFileRoute("/api/badge/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const username = usernameFromSvgSplat(params._splat);
        if (!username) {
          return new Response("Invalid username", { status: 400 });
        }
        const { fetchCalendar } = await import("@/lib/github/fetch.server");
        const { badgeSvg } = await import("@/lib/github/svg");
        const calendar = await fetchCalendar({
          username,
          today: todayIso(),
        });
        if (isGithubFnError(calendar)) {
          return new Response(calendar.error, {
            status: calendar.code === "not_found" ? 404 : 429,
          });
        }
        return svgResponse(
          badgeSvg({
            login: calendar.profile.login,
            streak: calendar.stats.currentStreak,
            today: calendar.stats.today,
            total: calendar.stats.total,
          }),
        );
      },
    },
  },
});
