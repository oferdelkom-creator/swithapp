"use client";

import { LOCALE_COOKIE } from "@/lib/i18n/locale";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "@/lib/i18n/translations";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "he", label: "עברית" },
  { value: "ru", label: "RU" },
  { value: "ar", label: "العربية" },
];

export default function LanguageSwitcher() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function setLocale(next: Locale) {
    if (next === locale) return;
    // eslint-disable-next-line react-hooks/immutability -- setting a cookie from a click handler is a legitimate side effect, not a render-time mutation
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    if (pathname.startsWith("/ar") && next !== "ar") {
      router.push("/");
      router.refresh();
      return;
    }
    // Clear route payloads prefetched in the previous language as well as
    // re-rendering the current page with the new locale cookie.
    window.location.reload();
  }

  return (
    <div className="flex items-center rounded-full border border-neutral-200 text-xs overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`px-2 py-1 ${
            locale === opt.value ? "bg-brand-blue text-white" : "text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
