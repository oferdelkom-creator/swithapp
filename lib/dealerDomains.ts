const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "mail", "support", "help"]);

export function normalizeDealerSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function isValidDealerSlug(input: string): boolean {
  const slug = normalizeDealerSlug(input);
  return slug.length >= 3 && !RESERVED_SLUGS.has(slug);
}

export function normalizeCustomDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.pathname !== "/" || url.search || url.hash || url.port) return null;
    const hostname = url.hostname.replace(/\.$/, "");
    if (!hostname.includes(".") || hostname === "switchapp.co.il" || hostname.endsWith(".switchapp.co.il")) return null;
    return hostname;
  } catch {
    return null;
  }
}
