const RESERVED_ROUTE_LIST = [
  "compare",
  "board",
  "docs",
  "api",
  "about",
  "privacy",
  "terms",
  "login",
  "settings",
  "recap",
  "u",
  "static",
  "assets",
  "favicon.ico",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "og",
  "og.jpg",
  "health",
  "embed",
  "auth",
] as const;

type ReservedRoutesCollection = ReadonlySet<string> & {
  includes: (value: string) => boolean;
};

const reservedSet = new Set<string>(
  RESERVED_ROUTE_LIST.map((r) => r.toLowerCase()),
);

export const RESERVED_ROUTES: ReservedRoutesCollection = Object.assign(
  reservedSet,
  {
    includes(value: string) {
      return reservedSet.has(String(value).trim().toLowerCase());
    },
  },
);

export function isReservedRoute(name: string): boolean {
  if (!name) return false;
  return reservedSet.has(name.trim().toLowerCase());
}

/**
 * GitHub username rules:
 * - 1 to 39 characters
 * - ASCII letters, digits, and single hyphens only
 * - Cannot start or end with a hyphen
 * - Cannot contain consecutive hyphens
 */
export const USERNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export type ParsedGithubUsername =
  | {
      ok: true;
      username: string;
      isReserved: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function invalidUsername(error: string): ParsedGithubUsername {
  return {
    ok: false,
    error,
  };
}

export function parseGithubUsername(input: string): ParsedGithubUsername {
  const raw = (typeof input === "string" ? input : "").trim();
  if (!raw) {
    return invalidUsername("Enter a GitHub username.");
  }

  let candidate = raw;

  const githubUrlMatch = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com(?:\/(.*))?$/i,
  );
  const cadenceUrlMatch = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?git-cadence\.grok\.me(?:\/(.*))?$/i,
  );

  if (githubUrlMatch) {
    const rest = (githubUrlMatch[1] ?? "").split(/[?#]/)[0] ?? "";
    const segments = rest
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const s0 = segments[0]?.toLowerCase() ?? "";
    const rawSeg =
      (s0 === "users" || s0 === "orgs") && segments[1]
        ? segments[1]
        : (segments[0] ?? "");
    const first = rawSeg.replace(/^@/, "");
    if (!first) {
      return invalidUsername(
        "Enter a GitHub username after github.com/.",
      );
    }
    candidate = first;
  } else if (cadenceUrlMatch) {
    const rest = (cadenceUrlMatch[1] ?? "").split(/[?#]/)[0] ?? "";
    const segments = rest
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const s0 = segments[0]?.toLowerCase() ?? "";
    const first =
      (s0 === "u" || s0 === "embed" || s0 === "recap") && segments[1]
        ? segments[1]
        : (segments[0] ?? "");
    const cleaned = first.replace(/^@/, "");
    if (!cleaned) {
      return invalidUsername("Enter a GitHub username.");
    }
    candidate = cleaned;
  } else if (/^https?:\/\//i.test(raw)) {
    return invalidUsername(
      "Enter a GitHub username or a github.com profile URL.",
    );
  } else if (raw.startsWith("@")) {
    candidate = raw.slice(1);
  }

  if (!candidate) {
    return invalidUsername(
      "GitHub usernames can only contain letters, numbers and single hyphens.",
    );
  }

  if (candidate.length > 39) {
    return invalidUsername(
      "GitHub usernames must be 39 characters or fewer.",
    );
  }

  if (!/^[a-zA-Z0-9-]+$/.test(candidate)) {
    return invalidUsername(
      "GitHub usernames can only contain letters, numbers and single hyphens.",
    );
  }

  if (candidate.startsWith("-") || candidate.endsWith("-")) {
    return invalidUsername(
      "GitHub usernames cannot start or end with a hyphen.",
    );
  }

  if (candidate.includes("--")) {
    return invalidUsername(
      "GitHub usernames can only contain letters, numbers and single hyphens (no consecutive hyphens).",
    );
  }

  if (!USERNAME_PATTERN.test(candidate)) {
    return invalidUsername(
      "GitHub usernames can only contain letters, numbers and single hyphens.",
    );
  }

  const isReserved = isReservedRoute(candidate);

  return {
    ok: true,
    username: candidate,
    isReserved,
  };
}

export function normalizeUsername(raw: string): string | null {
  const parsed = parseGithubUsername(raw);
  return parsed.ok ? parsed.username : null;
}

export function profileRoute(username: string): "/u/$username" | "/$username" {
  const clean = username.trim().replace(/^@/, "");
  return isReservedRoute(clean) ? "/u/$username" : "/$username";
}

export function profilePath(username: string): string {
  const clean = username.trim().replace(/^@/, "");
  return isReservedRoute(clean) ? `/u/${clean}` : `/${clean}`;
}

export function recapPath(username: string, year: number | string): string {
  const clean = username.trim().replace(/^@/, "");
  return isReservedRoute(clean)
    ? `/u/${clean}/${year}`
    : `/${clean}/${year}`;
}

export function usernameFromSvgSplat(splat: string | undefined): string | null {
  if (!splat) return null;
  return normalizeUsername(splat.replace(/\.svg$/i, ""));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string | undefined | null): s is string {
  if (typeof s !== "string" || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function resolveSelectedDate(
  dateFromUrl: string | undefined,
  yearFromUrl: number | undefined,
  today: string,
): string {
  const todayYear = Number(today.slice(0, 4));
  const defaultDate =
    yearFromUrl && yearFromUrl < todayYear
      ? `${yearFromUrl}-12-31`
      : today;
  if (
    dateFromUrl &&
    isValidIsoDate(dateFromUrl) &&
    dateFromUrl <= today &&
    (!yearFromUrl || dateFromUrl.startsWith(`${yearFromUrl}-`))
  ) {
    return dateFromUrl;
  }
  return defaultDate;
}
