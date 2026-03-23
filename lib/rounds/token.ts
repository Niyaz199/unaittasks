export function extractRoundsToken(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const queryToken = url.searchParams.get("token");
    if (queryToken) return queryToken.trim();

    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return raw;
  }
}
