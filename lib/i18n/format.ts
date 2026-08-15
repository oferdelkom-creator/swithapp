import type { Locale } from "./translations";

export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US");
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale === "he" ? "he-IL" : "en-US");
}
