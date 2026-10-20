#!/usr/bin/env node
/**
 * Trigger one leaderboard indexer run against a running Cadence server.
 *
 *   CRON_SECRET=... node scripts/index-board.mjs [baseUrl] [--status]
 *
 * Defaults to http://localhost:8080. The server does the work (it owns the
 * database and GitHub token); this is only an authenticated trigger, same as
 * the Vercel Cron entry in vercel.json.
 */
const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const baseUrl = (args.find((a) => a.startsWith("http")) || "http://localhost:8080").replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();
if (!secret) {
  console.error("[index-board] CRON_SECRET is not set — export it first (same value as the server).");
  process.exit(1);
}

const url = `${baseUrl}/api/cron/index-board${statusOnly ? "?status=1" : ""}`;
const res = await fetch(url, {
  method: statusOnly ? "GET" : "POST",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(240_000),
});
const body = await res.json().catch(() => null);
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
