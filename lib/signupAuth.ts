import { isValidDealerSlug, normalizeCustomDomain, normalizeDealerSlug } from "./dealerDomains";

// User-editable draft only, never an authorization claim. RLS remains authoritative.
export function dealerSignupDraft(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Missing signup details");
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const s = v[key];
    if (typeof s !== "string" || s.length > max) throw new Error("Invalid signup details");
    return s.trim();
  };
  const businessName = text("businessName", 200);
  const phone = text("phone", 40);
  const dealerSlug = text("dealerSlug", 63);
  if (!businessName || normalizeDealerSlug(dealerSlug) !== dealerSlug || !isValidDealerSlug(dealerSlug)) throw new Error("Invalid signup details");
  if (v.role !== "dealer" && v.role !== "importer") throw new Error("Invalid signup role");
  if (v.cap !== 0 && v.cap !== 1) throw new Error("Invalid signup plan");
  const customDomain = v.customDomain === null || v.customDomain === "" ? null : text("customDomain", 253);
  if (customDomain && normalizeCustomDomain(customDomain) !== customDomain) throw new Error("Invalid signup domain");
  return { businessName, phone, dealerSlug, customDomain, role: v.role, cap: v.cap } as { businessName: string; phone: string; dealerSlug: string; customDomain: string | null; role: "dealer" | "importer"; cap: number };
}

export function safeAuthNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  try {
    const u = new URL(value, "https://switchautoai.com");
    if (u.origin !== "https://switchautoai.com" || u.pathname.startsWith("/auth/")) return "/";
    return u.pathname + u.search;
  } catch { return "/"; }
}
