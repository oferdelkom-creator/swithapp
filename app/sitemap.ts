import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: cars }, { data: dealers }] = await Promise.all([
    supabase.from("cars").select("id, updated_at").is("sold_at", null).eq("is_seed", false),
    supabase
      .from("users")
      .select("dealer_slug, created_at")
      .in("role", ["dealer", "importer"])
      .not("dealer_slug", "is", null),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/ar`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/swipe`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/business/join`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/demo/dealer`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/demo/importer`, changeFrequency: "monthly", priority: 0.5 },
  ];
  const carEntries: MetadataRoute.Sitemap = (cars ?? []).map((car) => ({
    url: `${SITE_URL}/cars/${car.id}`,
    lastModified: car.updated_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  const dealerEntries: MetadataRoute.Sitemap = (dealers ?? []).flatMap((dealer) =>
    dealer.dealer_slug
      ? [{ url: `${SITE_URL}/d/${dealer.dealer_slug}`, lastModified: dealer.created_at, changeFrequency: "weekly" as const, priority: 0.7 }]
      : []
  );

  return [...staticEntries, ...carEntries, ...dealerEntries];
}
