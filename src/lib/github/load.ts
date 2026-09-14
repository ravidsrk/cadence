import { getActivitySplit, getCalendar, getDayCommits, getLanguageMix } from "./api";
import type {
  ActivitySplit,
  CalendarLoaderData,
  CalendarPayload,
  GithubFnError,
  LanguageMixItem,
} from "./types";

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

export async function loadCalendarOnly(input: {
  username: string;
  today: string;
  year?: number;
}): Promise<CalendarPayload | GithubFnError> {
  return getCalendar({
    data: { username: input.username, year: input.year, today: input.today },
  });
}

export type RecapLoaderData = {
  today: string;
  username: string;
  year: number;
  calendar: CalendarPayload | GithubFnError;
  languages: { items: LanguageMixItem[] } | GithubFnError;
  split: ActivitySplit | GithubFnError;
};

export async function loadRecap(input: {
  username: string;
  today: string;
  year: number;
}): Promise<RecapLoaderData> {
  const date =
    input.year === Number(input.today.slice(0, 4))
      ? input.today
      : `${input.year}-12-31`;
  const [calendar, languages, split] = await Promise.all([
    getCalendar({
      data: { username: input.username, year: input.year, today: input.today },
    }),
    getLanguageMix({ data: { username: input.username } }),
    getActivitySplit({
      data: {
        username: input.username,
        from: `${input.year}-01-01`,
        to: date,
      },
    }),
  ]);
  return {
    today: input.today,
    username: input.username,
    year: input.year,
    calendar,
    languages,
    split,
  };
}
