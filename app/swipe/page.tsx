import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import SwipeDeck from "./SwipeDeck";

export default async function SwipePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sale-mode browsing needs no account (cars_for_sale() takes a null my_id) - a
  // signed-out visitor only hits an auth prompt once they act on real intent
  // (Trade/Buy), inline in SwipeDeck. Swap mode still requires signing in first.
  const { data: me } = user
    ? await supabase
        .from("users")
        .select("lat, lon, premium_until")
        .eq("id", user.id)
        .maybeSingle<{ lat: number | null; lon: number | null; premium_until: string | null }>()
    : { data: null };

  const isPremium = !!me?.premium_until && new Date(me.premium_until) > new Date();

  return (
    <div className="max-w-md md:max-w-6xl mx-auto px-4 py-4">
      <h1 className="text-xl font-semibold mb-3">{t("swipe.title")}</h1>
      <SwipeDeck
        userId={user?.id ?? null}
        initialLat={me?.lat ?? null}
        initialLon={me?.lon ?? null}
        isPremium={isPremium}
      />
    </div>
  );
}
