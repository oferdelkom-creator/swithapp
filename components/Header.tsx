import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "./LanguageSwitcher";

export default async function Header() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("users")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle<{ is_admin: boolean; role: string }>()
      ).data
    : null;
  const isAdmin = profile?.is_admin ?? false;
  const isBusiness = profile?.role === "dealer" || profile?.role === "importer";

  const likesCount = user
    ? ((await supabase.rpc("count_incoming_likes", { my_id: user.id })).data as number | null)
    : null;

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand-blue-dark tracking-tight">
          SwitchApp
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm">
            {user ? (
              <>
                <NavLink href="/swipe">{t("nav.swipe")}</NavLink>
                <NavLink href="/cars">{t("nav.cars")}</NavLink>
                <NavLink href="/matches">{t("nav.matches")}</NavLink>
                <NavLink href="/likes">
                  {t("nav.likes")}
                  {!!likesCount && (
                    <span className="ms-1 inline-flex items-center justify-center rounded-full bg-brand-orange text-white text-[10px] min-w-[16px] h-4 px-1">
                      {likesCount}
                    </span>
                  )}
                </NavLink>
                {isBusiness && <NavLink href="/business">{t("nav.business")}</NavLink>}
                {isAdmin && <NavLink href="/admin">{t("nav.admin")}</NavLink>}
              </>
            ) : (
              <NavLink href="/login" primary>
                {t("nav.signIn")}
              </NavLink>
            )}
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-full bg-brand-blue text-white px-4 py-1.5 hover:bg-brand-blue-dark transition-colors"
          : "rounded-full px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-brand-blue-dark transition-colors"
      }
    >
      {children}
    </Link>
  );
}
