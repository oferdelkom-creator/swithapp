import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignStudio, { type CampaignDraft, type CampaignVehicle } from "./CampaignStudio";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/business/login?next=/business/campaigns");

  const { data: profile } = await supabase
    .from("users")
    .select("role, business_name")
    .eq("id", user.id)
    .maybeSingle<{ role: string; business_name: string | null }>();
  if (!profile || !["dealer", "importer"].includes(profile.role)) redirect("/");

  const [{ data: cars }, { data: campaigns }] = await Promise.all([
    supabase
      .from("cars")
      .select("id, make, model, year, price, photo_urls")
      .eq("user_id", user.id)
      .is("sold_at", null)
      .order("created_at", { ascending: false })
      .returns<CampaignVehicle[]>(),
    supabase
      .from("dealer_campaigns")
      .select("id, car_id, platform, objective, status, headline, primary_text, daily_budget, target_region, destination_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<CampaignDraft[]>(),
  ]);

  return <CampaignStudio userId={user.id} businessName={profile.business_name ?? "המגרש שלי"} cars={cars ?? []} initialCampaigns={campaigns ?? []} />;
}
