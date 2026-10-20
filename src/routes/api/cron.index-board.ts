import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/github/http";

/**
 * Scheduled leaderboard indexer. Two callers:
 *  - Vercel Cron (`vercel.json`) sends `Authorization: Bearer $CRON_SECRET`.
 *  - `npm run index:board` posts the same header from any shell.
 * Without a configured CRON_SECRET the route refuses to run — a full
 * discovery sweep spends GitHub rate budget and must never be world-open.
 */
export const Route = createFileRoute("/api/cron/index-board")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim();
        if (!secret) {
          return jsonResponse(
            { error: "CRON_SECRET is not configured" },
            503,
            0,
          );
        }
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) {
          return jsonResponse({ error: "Unauthorized" }, 401, 0);
        }
        const params = new URL(request.url).searchParams;
        const num = (key: string, fallback: number, max: number) => {
          const raw = Number(params.get(key));
          return Number.isFinite(raw) && raw > 0
            ? Math.min(max, Math.round(raw))
            : fallback;
        };
        const { runIndexer } = await import("@/lib/github/indexer.server");
        const stats = await runIndexer({
          kind: "cron",
          clickHouseLimit: num("clickHouseLimit", 500, 1000),
          followerPages: num("followerPages", 2, 10),
          processLimit: num("processLimit", 256, 500),
          budgetMs: 110_000,
          skipDiscovery: params.get("skipDiscovery") === "1",
        });
        return jsonResponse({ ok: stats.errors.length === 0, ...stats }, 200, 0);
      },
      // Vercel Cron invokes with GET (+ Bearer CRON_SECRET when configured),
      // so GET runs the indexer too; `?status=1` returns queue status only.
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim();
        if (!secret) {
          return jsonResponse({ error: "CRON_SECRET is not configured" }, 503, 0);
        }
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) {
          return jsonResponse({ error: "Unauthorized" }, 401, 0);
        }
        const params = new URL(request.url).searchParams;
        if (params.get("status") === "1") {
          const { getIndexerStatus } = await import(
            "@/lib/github/indexer.server"
          );
          return jsonResponse(await getIndexerStatus(), 200, 0);
        }
        const { runIndexer } = await import("@/lib/github/indexer.server");
        const stats = await runIndexer({ kind: "cron", budgetMs: 110_000 });
        return jsonResponse({ ok: stats.errors.length === 0, ...stats }, 200, 0);
      },
    },
  },
});
