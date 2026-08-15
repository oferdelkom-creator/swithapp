import type { Locale } from "./translations";
import { DEFAULT_LOCALE, LOCALES } from "./translations";

export const LOCALE_COOKIE = "locale";

export function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  // "he-IL,he;q=0.9,en-US;q=0.8" -> first tag's primary subtag.
  const first = header.split(",")[0]?.trim().split("-")[0]?.toLowerCase();
  return (LOCALES as string[]).includes(first) ? (first as Locale) : DEFAULT_LOCALE;
}

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}
