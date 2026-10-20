import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidIsoDate, USERNAME_PATTERN } from "./username";
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

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => isValidIsoDate(s), "Invalid calendar date");

export const getCalendar = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        year: z.number().int().min(2008).max(2100).optional(),
        today: isoDateSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CalendarPayload | GithubFnError> => {
    const { fetchCalendar } = await import("./fetch.server");
    const result = await fetchCalendar(data);
    if (!("error" in result) && !data.year) {
      void import("./board.server")
        .then(({ autoSyncBoardProfile }) =>
          autoSyncBoardProfile(result, data.today),
        )
        .catch(() => {});
    }
    return result;
  });

export const getCachedCalendarOnly = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        year: z.number().int().min(2008).max(2100).optional(),
        today: isoDateSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CalendarPayload | null> => {
    const { getCachedCalendar } = await import("./fetch.server");
    return getCachedCalendar(data);
  });

export const getDayCommits = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: usernameSchema,
        date: isoDateSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DayCommitsPayload | GithubFnError> => {
    const { fetchDayCommits } = await import("./fetch.server");
    return fetchDayCommits(data);
  });

export const getBoard = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        sort: z
          .enum(["score", "peak", "day", "streak", "consistency", "volume", "active", "momentum"])
          .optional(),
        window: z.enum(["7d", "30d", "90d", "12m"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).max(10_000).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadBoard } = await import("./board.server");
    return loadBoard(data ?? {});
  });

export const getIndexerStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getIndexerStatus } = await import("./indexer.server");
    return getIndexerStatus();
  },
);

/**
 * Bounded manual refresh from the board UI: drains a small slice of the
 * candidate queue (no full discovery sweep — that stays on the cron route,
 * so an anonymous click can never burn the whole GitHub rate budget).
 */
export const refreshBoardIndex = createServerFn({ method: "POST" }).handler(
  async () => {
    const { processQueue, getIndexerStatus } = await import("./indexer.server");
    const processed = await processQueue({ limit: 32, budgetMs: 25_000 });
    const status = await getIndexerStatus();
    return { processed, status };
  },
);

export const addBoard = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ username: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { addBoardProfile } = await import("./board.server");
    return addBoardProfile(data.username);
  });

export const discoverTrending = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        language: z.string().trim().max(40).optional(),
        since: z.enum(["daily", "weekly", "monthly"]).optional(),
        syncToBoard: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { discoverTrendingDevelopers } = await import("./board.server");
    return discoverTrendingDevelopers(data);
  });

export const discoverTrendingRepos = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        language: z.string().trim().max(40).optional(),
        since: z.enum(["daily", "weekly", "monthly"]).optional(),
        syncToBoard: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { discoverTrendingRepositories } = await import("./board.server");
    return discoverTrendingRepositories(data);
  });

export const getBuilderPortfolio = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ username: usernameSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { fetchBuilderPortfolio } = await import("./treg.server");
    return fetchBuilderPortfolio(data.username);
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
        from: isoDateSchema,
        to: isoDateSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ActivitySplit | GithubFnError> => {
    const { fetchActivitySplit } = await import("./fetch.server");
    return fetchActivitySplit(data);
  });
