import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, translate, type Locale } from "./translations";
import { isLocale, LOCALE_COOKIE, parseAcceptLanguage } from "./locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  // No cookie yet (proxy.ts normally sets one on first request) - fall back to
  // Accept-Language directly so server components never guess wrong.
  const headerList = await headers();
  return parseAcceptLanguage(headerList.get("accept-language"));
}

export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
  };
}

export { DEFAULT_LOCALE };
