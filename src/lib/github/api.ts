import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { USERNAME_PATTERN } from "./username";
import type {
  ActivitySplit,
  CalendarPayload,
  DayCommitsPayload,
  GithubFnError,
  LanguageMixItem,
} from "./types";

const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(USERNAME_PATTERN);

export const getCalendar = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        year: z.number().int().min(2008).max(2100).optional(),
        today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CalendarPayload | GithubFnError> => {
    const { fetchCalendar } = await import("./fetch.server");
    return fetchCalendar(data);
  });

export const getDayCommits = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DayCommitsPayload | GithubFnError> => {
    const { fetchDayCommits } = await import("./fetch.server");
    return fetchDayCommits(data);
  });

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { loadBoard } = await import("./board.server");
  return loadBoard();
});

export const addBoard = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ username: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { addBoardProfile } = await import("./board.server");
    return addBoardProfile(data.username);
  });

export const getLanguageMix = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ username: usernameSchema }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ items: LanguageMixItem[] } | GithubFnError> => {
      const { fetchLanguageMix } = await import("./fetch.server");
      return fetchLanguageMix(data.username);
    },
  );

export const getActivitySplit = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ActivitySplit | GithubFnError> => {
    const { fetchActivitySplit } = await import("./fetch.server");
    return fetchActivitySplit(data);
  });
