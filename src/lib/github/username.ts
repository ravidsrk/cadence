export const USERNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export function normalizeUsername(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/^@+/, "");
  value = value.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  value = (value.split(/[/?#]/)[0] ?? value).trim();
  if (!USERNAME_PATTERN.test(value)) return null;
  return value;
}
