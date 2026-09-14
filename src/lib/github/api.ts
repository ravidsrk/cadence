import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { USERNAME_PATTERN } from "./username";
import type { CalendarPayload, DayCommitsPayload, GithubFnError } from "./types";

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
