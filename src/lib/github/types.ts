export type DayCount = {
  date: string;
  count: number;
  level: number;
};

export type GithubProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
};

export type CalendarStats = {
  total: number;
  today: number;
  week: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: { date: string; count: number } | null;
  activeDays: number;
};

export type CalendarPayload = {
  username: string;
  profile: GithubProfile;
  range: { from: string; to: string };
  days: DayCount[];
  stats: CalendarStats;
};

export type DayCommit = {
  sha: string;
  message: string;
  htmlUrl: string;
  repo: string;
  authoredAt: string;
  authorName: string;
};

export type DayCommitsPayload = {
  date: string;
  total: number;
  incomplete: boolean;
  commits: DayCommit[];
};

export type GithubFnError = {
  error: string;
  code: "not_found" | "rate_limit" | "unavailable";
};

export function isGithubFnError(value: unknown): value is GithubFnError {
  return (
    !!value &&
    typeof value === "object" &&
    "error" in value &&
    "code" in value &&
    typeof (value as GithubFnError).error === "string"
  );
}

export type CalendarLoaderData = {
  today: string;
  username: string;
  calendar: CalendarPayload | GithubFnError;
  commits: DayCommitsPayload | GithubFnError;
};

export function cadenceError(
  message: string,
  code: GithubFnError["code"] = "not_found",
): GithubFnError {
  return { error: message, code };
}

