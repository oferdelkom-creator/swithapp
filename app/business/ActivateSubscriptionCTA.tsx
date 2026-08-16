"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { DEALER_TIERS, tierPriceFor } from "@/lib/dealerPricing";

// No payment gateway is wired up (see README) - clicking this doesn't charge anything.
// It just self-sets billing_plan (not an admin-protected column), which flips the UI
// into a "pending" state; our team still activates subscription_valid_until manually
// from /admin (ActivateSubscriptionButton), same as a fresh /business/join signup.
//
// Price shown is the same tiered pricing from /business/join (lib/dealerPricing.ts),
// not a flat number - it's whichever tier requestedCarCap maps to, or the base "up to
// 50 cars" tier as a fallback for a dealer set up before that flow existed (so
// requestedCarCap is null) and hasn't stated a size.
export default function ActivateSubscriptionCTA({
  userId,
  billingPlan,
  requestedCarCap,
}: {
  userId: string;
  billingPlan: string | null;
  requestedCarCap: number | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(billingPlan === "subscription");
  const price = tierPriceFor(requestedCarCap) ?? DEALER_TIERS[0].priceMonthly ?? 0;

  async function activate() {
    setRequesting(true);
    const supabase = createClient();
    await supabase.from("users").update({ billing_plan: "subscription" }).eq("id", userId);
    setRequesting(false);
    setRequested(true);
    router.refresh();
  }

  if (requested) {
    return <p className="text-amber-600 font-medium text-sm">{t("business.subscriptionPending")}</p>;
  }

  return (
    <button type="button" onClick={activate} disabled={requesting} className="btn-primary text-sm">
      {requesting ? t("carForm.saving") : t("business.activateSubscriptionCta", { price })}
    </button>
  );
}
