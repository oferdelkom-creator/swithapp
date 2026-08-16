import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import type { Car } from "@/lib/types";
import ProfileStats, { type Stats } from "@/app/profile/ProfileStats";
import InventoryTable from "./InventoryTable";
import PublicPageLink from "./PublicPageLink";
import CustomDomainCard from "./CustomDomainCard";
import DealerBrandingCard from "./DealerBrandingCard";

type InventoryCar = Pick<
  Car,
  "id" | "make" | "model" | "year" | "photo_urls" | "for_sale" | "for_swap" | "sold_at" | "price"
>;

export default async function BusinessPage() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/business");

  const { data: me } = await supabase
    .from("users")
    .select(
      "role, business_name, billing_plan, subscription_valid_until, dealer_slug, custom_domain, custom_domain_active, logo_url, cover_photo_url, dealer_description, public_phone"
    )
    .eq("id", user.id)
    .maybeSingle<{
      role: string;
      business_name: string | null;
      billing_plan: string | null;
      subscription_valid_until: string | null;
      dealer_slug: string | null;
      custom_domain: string | null;
      custom_domain_active: boolean;
      logo_url: string | null;
      cover_photo_url: string | null;
      dealer_description: string | null;
      public_phone: string | null;
    }>();

  if (!me || (me.role !== "dealer" && me.role !== "importer")) redirect("/");

  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const siteOrigin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const [{ data: cars }, { data: statsRows }] = await Promise.all([
    supabase
      .from("cars")
      .select("id, make, model, year, photo_urls, for_sale, for_swap, sold_at, price")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<InventoryCar[]>(),
    supabase.rpc("get_profile_stats", { my_id: user.id }),
  ]);

  const stats = (statsRows as Stats[] | null)?.[0] ?? null;
  const active = me.subscription_valid_until && new Date(me.subscription_valid_until) > new Date();
  const inventory = cars ?? [];
  const forSaleCount = inventory.filter((c) => c.for_sale && !c.sold_at).length;
  const forSwapCount = inventory.filter((c) => c.for_swap && !c.sold_at).length;
  const soldCount = inventory.filter((c) => c.sold_at).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t("business.title")}</h1>
        <p className="text-neutral-500 text-sm">{me.business_name ?? "-"}</p>
      </div>

      {stats && <ProfileStats stats={stats} />}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xl font-semibold">{forSaleCount}</p>
          <p className="text-xs text-muted mt-1">{t("business.statForSale")}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xl font-semibold">{forSwapCount}</p>
          <p className="text-xs text-muted mt-1">{t("business.statForSwap")}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xl font-semibold">{soldCount}</p>
          <p className="text-xs text-muted mt-1">{t("business.statSold")}</p>
        </div>
      </div>

      <div className="card p-6 space-y-2 text-sm">
        <p>{t("business.plan", { plan: me.billing_plan ?? t("business.notSet") })}</p>
        <p>
          {t("business.subscription")}{" "}
          {active ? (
            <span className="text-emerald-700 font-medium">
              {t("business.activeUntil", { date: formatDate(me.subscription_valid_until!, locale) })}
            </span>
          ) : (
            <span className="text-red-600 font-medium">{t("business.inactive")}</span>
          )}
        </p>
        <p className="text-neutral-500 pt-2">{t("business.noSelfServe")}</p>
      </div>

      <PublicPageLink
        userId={user.id}
        initialSlug={me.dealer_slug}
        businessName={me.business_name}
        siteOrigin={siteOrigin}
      />

      <CustomDomainCard userId={user.id} initialDomain={me.custom_domain} active={me.custom_domain_active} />

      <DealerBrandingCard
        userId={user.id}
        initialLogoUrl={me.logo_url}
        initialCoverPhotoUrl={me.cover_photo_url}
        initialDescription={me.dealer_description}
        initialPublicPhone={me.public_phone}
      />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">{t("business.inventoryTitle", { count: inventory.length })}</h2>
          <Link href="/cars" className="text-sm text-brand-blue">
            {t("business.manageListings")}
          </Link>
        </div>
        <InventoryTable inventory={inventory} />
      </div>
    </div>
  );
}
