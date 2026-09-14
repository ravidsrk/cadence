import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, parseYearParam } from "@/lib/github/http";
import { todayIso } from "@/lib/github/load";
import { isGithubFnError } from "@/lib/github/types";
import { normalizeUsername } from "@/lib/github/username";

export const Route = createFileRoute("/api/calendar/$username")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const username = normalizeUsername(params.username);
        if (!username) {
          return jsonResponse({ error: "Invalid username" }, 400);
        }
        const year = parseYearParam(new URL(request.url).searchParams.get("year"));
        const { fetchCalendar } = await import("@/lib/github/fetch.server");
        const calendar = await fetchCalendar({
          username,
          today: todayIso(),
          year,
        });
        if (isGithubFnError(calendar)) {
          return jsonResponse(
            calendar,
            calendar.code === "not_found" ? 404 : 429,
          );
        }
        return jsonResponse({
          username: calendar.profile.login,
          profile: calendar.profile,
          range: calendar.range,
          stats: calendar.stats,
          days: calendar.days,
        });
      },
    },
  },
});
