"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "@/lib/i18n/translations";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "he", label: "עב" },
  { value: "ru", label: "RU" },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = useLocale();

  function setLocale(next: Locale) {
    if (next === locale) return;
    // eslint-disable-next-line react-hooks/immutability -- setting a cookie from a click handler is a legitimate side effect, not a render-time mutation
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
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
