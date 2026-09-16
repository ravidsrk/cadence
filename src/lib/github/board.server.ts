import { getSql } from "@/lib/db";
import { BOARD_MAX, rankBoard, type BoardEntry, type BoardSort } from "./board";
import { fetchCalendar } from "./fetch.server";
import { todayIso } from "./load";
import { normalizeUsername } from "./username";
import type { CalendarPayload, GithubFnError } from "./types";

export type BoardPayload = {
  today: string;
  max: number;
  entries: BoardEntry[];
};

async function listedUsernames(): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ username: string }>`
    select username from board_profiles order by added_at asc
  `;
  return rows.map((row) => row.username);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item === undefined) return;
      out[index] = await fn(item);
    }
  }
  const n = Math.min(Math.max(limit, 1), items.length || 1);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function loadBoard(sort: BoardSort = "peak"): Promise<BoardPayload> {
  const today = todayIso();
  const usernames = await listedUsernames();
  const calendars = await mapPool(usernames, 5, (username) =>
    fetchCalendar({ username, today }),
  );
  const rows = usernames.map((username, index) => ({
    username,
    calendar: calendars[index] as CalendarPayload | GithubFnError,
  }));
  return {
    today,
    max: BOARD_MAX,
    entries: rankBoard(rows, sort),
  };
}

export async function addBoardProfile(
  raw: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, error: "Enter a GitHub username or profile URL." };
  }
  const login = username.toLowerCase();
  const sql = await getSql();
  const existing = await sql<{ username: string }>`
    select username from board_profiles where username = ${login} limit 1
  `;
  if (existing[0]) {
    return { ok: true, already: true };
  }
  const counted = await sql<{ n: number }>`
    select count(*)::int as n from board_profiles
  `;
  if ((counted[0]?.n ?? 0) >= BOARD_MAX) {
    return {
      ok: false,
      error: `Board is full (${BOARD_MAX} public profiles).`,
    };
  }
  const today = todayIso();
  const calendar = await fetchCalendar({ username: login, today });
  if ("error" in calendar) {
    if (calendar.code === "not_found") {
      return { ok: false, error: "GitHub has no public user with that login." };
    }
    return { ok: false, error: calendar.error };
  }
  await sql`
    insert into board_profiles (username) values (${login})
    on conflict (username) do nothing
  `;
  return { ok: true, already: false };
}
