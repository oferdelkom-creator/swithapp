import Link from "next/link";
import Image from "next/image";
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
  partnerSite,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
  isBusiness: boolean;
  likesCount: number | null;
  unreadMatches: number | null;
  partnerSite: boolean;
}) {
  const { t } = await getT();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className={`flex items-center gap-2 font-bold text-lg tracking-tight shrink-0 ${partnerSite ? "text-slate-950" : "text-brand-blue-dark"}`}>
          {partnerSite ? <Image src="/brand/switchautoai-mark.svg" alt="" width={32} height={32} priority /> : null}
          <span>{partnerSite ? "SwitchAuto AI" : "SwitchApp"}</span>
        </Link>
        {loggedIn && partnerSite && isBusiness && (
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Business">
            <Link href="/business" className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950">{t("nav.business")}</Link>
            <Link href="/cars" className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950">{t("nav.cars")}</Link>
            <Link href="/business/import" className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950">{t("business.importInventory")}</Link>
          </nav>
        )}
        {loggedIn && !partnerSite && (
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
              className={`rounded-full px-4 py-1.5 text-sm text-white transition-colors ${partnerSite ? "bg-slate-950 hover:bg-slate-800" : "bg-brand-blue hover:bg-brand-blue-dark"}`}
            >
              {partnerSite ? t("partnerLogin.formTitle") : t("nav.signIn")}
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
