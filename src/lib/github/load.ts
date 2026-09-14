import { getCalendar, getDayCommits } from "./api";
import type { CalendarLoaderData } from "./types";

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function loadCadence(input: {
  username: string;
  today: string;
  date: string;
  year?: number;
}): Promise<CalendarLoaderData> {
  const [calendar, commits] = await Promise.all([
    getCalendar({
      data: { username: input.username, year: input.year, today: input.today },
    }),
    getDayCommits({
      data: { username: input.username, date: input.date },
    }),
  ]);
  return {
    today: input.today,
    username: input.username,
    calendar,
    commits,
  };
}
