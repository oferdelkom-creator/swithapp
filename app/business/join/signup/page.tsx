import { Suspense } from "react";
import DealerJoinForm from "../DealerJoinForm";
import { createClient } from "@/lib/supabase/server";
import { DEALER_FREE_TRIAL_LIMIT } from "@/lib/dealerPricing";

export default async function DealerSignupPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .not("dealer_trial_started_at", "is", null);
  const remainingTrialSlots = Math.max(0, DEALER_FREE_TRIAL_LIMIT - (count ?? 0));
  return (
    <Suspense fallback={null}>
      <DealerJoinForm remainingTrialSlots={remainingTrialSlots} />
    </Suspense>
  );
}
