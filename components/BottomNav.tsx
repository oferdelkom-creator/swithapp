"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";

export default function BottomNav({
  isAdmin,
  isBusiness,
  likesCount,
}: {
  isAdmin: boolean;
  isBusiness: boolean;
  likesCount: number | null;
}) {
  const { t } = useLocale();
  const pathname = usePathname();

  const items = [
    { href: "/swipe", label: t("nav.swipe"), icon: SwipeIcon },
    { href: "/cars", label: t("nav.cars"), icon: CarIcon },
    { href: "/matches", label: t("nav.matches"), icon: MatchIcon },
    { href: "/likes", label: t("nav.likes"), icon: LikeIcon, badge: likesCount },
    ...(isBusiness ? [{ href: "/business", label: t("nav.business"), icon: BusinessIcon }] : []),
    ...(isAdmin ? [{ href: "/admin", label: t("nav.admin"), icon: AdminIcon }] : []),
    { href: "/profile", label: t("nav.profile"), icon: ProfileIcon },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="max-w-5xl mx-auto flex items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
                active ? "text-brand-blue-dark" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <span className="relative">
                <Icon active={!!active} />
                {!!item.badge && (
                  <span className="absolute -top-1 -end-2.5 inline-flex items-center justify-center rounded-full bg-brand-orange text-white text-[9px] min-w-[15px] h-[15px] px-1">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

type IconProps = { active: boolean };

function SwipeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="12" height="16" rx="2.5" transform="rotate(-8 10 12)" />
      <rect x="8" y="4" width="12" height="16" rx="2.5" fill={active ? "currentColor" : "white"} />
    </svg>
  );
}

function CarIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2A2 2 0 0 1 19.5 8l1.5 5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2.5" y="13" width="19" height="5.5" rx="1.5" fill={active ? "currentColor" : "none"} />
      <circle cx="7" cy="18.5" r="1.6" fill="white" />
      <circle cx="17" cy="18.5" r="1.6" fill="white" />
    </svg>
  );
}

function MatchIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 20s-7.5-4.6-9.5-9.3C1.3 7.6 3 4.5 6.2 4.5c2 0 3.4 1.1 4.2 2.4L12 8.6l1.6-1.7c.8-1.3 2.2-2.4 4.2-2.4 3.2 0 4.9 3.1 3.7 6.2C19.5 15.4 12 20 12 20z"
        fill={active ? "currentColor" : "none"}
        strokeLinejoin="round"
      />
      <path d="M8.5 11.5l2 2 4-4.2" stroke="white" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0} />
    </svg>
  );
}

function LikeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path
        d="M12 20s-7.5-4.6-9.5-9.3C1.3 7.6 3 4.5 6.2 4.5c2 0 3.4 1.1 4.2 2.4L12 8.6l1.6-1.7c.8-1.3 2.2-2.4 4.2-2.4 3.2 0 4.9 3.1 3.7 6.2C19.5 15.4 12 20 12 20z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BusinessIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7.5" width="18" height="12" rx="2" fill={active ? "currentColor" : "none"} />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdminIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6l7-3z" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" fill={active ? "currentColor" : "none"} />
      <path d="M4.5 19.5c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5" strokeLinecap="round" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
