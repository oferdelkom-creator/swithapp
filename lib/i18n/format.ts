import type { Locale } from "./translations";

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  he: "he-IL",
  ru: "ru-RU",
};

export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale]);
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale]);
}
