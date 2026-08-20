import PartnerLanding from "./PartnerLanding";
import { createClient } from "@/lib/supabase/server";
import { DEALER_FREE_TRIAL_LIMIT } from "@/lib/dealerPricing";

export default async function DealerJoinPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .not("dealer_trial_started_at", "is", null);
  return <PartnerLanding remainingTrialSlots={Math.max(0, DEALER_FREE_TRIAL_LIMIT - (count ?? 0))} />;
}
