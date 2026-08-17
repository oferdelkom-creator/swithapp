import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "./LanguageSwitcher";
import SignOutButton from "./SignOutButton";
import DesktopNav from "./DesktopNav";

export default async function Header({
  loggedIn,
  isAdmin,
  isBusiness,
  likesCount,
  unreadMatches,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
  isBusiness: boolean;
  likesCount: number | null;
  unreadMatches: number | null;
}) {
  const { t } = await getT();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-lg text-brand-blue-dark tracking-tight shrink-0">
          SwitchApp
        </Link>
        {loggedIn && (
          <DesktopNav
            isAdmin={isAdmin}
            isBusiness={isBusiness}
            likesCount={likesCount}
            unreadMatches={unreadMatches}
          />
        )}
        <div className="flex items-center gap-3 shrink-0">
          {loggedIn ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand-blue text-white px-4 py-1.5 text-sm hover:bg-brand-blue-dark transition-colors"
            >
              {t("nav.signIn")}
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
