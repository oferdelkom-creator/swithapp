import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const [{ count }, { data: auth }] = await Promise.all([
    supabase.from("cars").select("id", { count: "exact", head: true }),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-brand-blue-dark tracking-tight">SwitchApp</h1>
      <p className="mt-3 text-lg text-muted">{t("home.tagline")}</p>

      <div className="mt-8">
        <Link href={auth.user ? "/swipe" : "/login"} className="btn-primary text-base px-6 py-3">
          {auth.user ? t("home.ctaSwipe") : t("home.ctaStart")}
        </Link>
      </div>

      <div className="mt-12 card px-6 py-4 inline-block">
        <p className="text-sm text-muted">{t("home.connected", { count: count ?? 0 })}</p>
      </div>
    </div>
  );
}
