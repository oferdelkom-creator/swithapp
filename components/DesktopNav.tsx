"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";

// The desktop counterpart to BottomNav.tsx - a horizontal link row in the header
// instead of a fixed bottom bar, shown only at md: and up (BottomNav stays mobile-only,
// hidden via md:hidden in layout.tsx). Same items/badges, same active-route logic,
// just laid out for a pointer + wide viewport instead of a thumb + narrow one.
export default function DesktopNav({
  isAdmin,
  isBusiness,
  likesCount,
  unreadMatches,
}: {
  isAdmin: boolean;
  isBusiness: boolean;
  likesCount: number | null;
  unreadMatches: number | null;
}) {
  const { t } = useLocale();
  const pathname = usePathname();

  const items = [
    { href: "/swipe", label: t("nav.swipe") },
    { href: "/cars", label: t("nav.cars") },
    { href: "/matches", label: t("nav.matches"), badge: unreadMatches },
    { href: "/likes", label: t("nav.likes"), badge: likesCount },
    ...(isBusiness ? [{ href: "/business", label: t("nav.business") }] : []),
    ...(isAdmin ? [{ href: "/admin", label: t("nav.admin") }] : []),
    { href: "/profile", label: t("nav.profile") },
  ];

  return (
    <nav className="hidden md:flex md:flex-1 items-center justify-center gap-1" aria-label="Primary">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? "text-brand-pink" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {item.label}
            {!!item.badge && (
              <span className="absolute -top-1 -end-1.5 inline-flex items-center justify-center rounded-full bg-brand-orange text-white text-[9px] min-w-[15px] h-[15px] px-1">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
