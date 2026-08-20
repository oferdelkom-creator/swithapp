import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import SwipeDeck from "@/app/swipe/SwipeDeck";

export default async function DealerMarketPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/business/market");

  const { data: profile } = await supabase
    .from("users")
    .select("role, lat, lon, subscription_valid_until")
    .eq("id", user.id)
    .maybeSingle<{
      role: string;
      lat: number | null;
      lon: number | null;
      subscription_valid_until: string | null;
    }>();

  const isDealer = profile?.role === "dealer" || profile?.role === "importer";
  const hasActiveSubscription =
    Boolean(profile?.subscription_valid_until) && new Date(profile!.subscription_valid_until!) > new Date();
  if (!isDealer || !hasActiveSubscription) redirect("/business");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{t("business.marketTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("business.marketDescription")}</p>
      </div>
      <SwipeDeck
        userId={user.id}
        initialLat={profile?.lat ?? null}
        initialLon={profile?.lon ?? null}
        isPremium
      />
    </div>
  );
}
