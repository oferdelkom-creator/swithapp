"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// No payment gateway is wired up yet - a dealer/importer subscription is activated by an
// admin for now, 30 days at a time (mirrors GrantPremiumButton for private users).
export default function ActivateSubscriptionButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function activate() {
    setLoading(true);
    const supabase = createClient();
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await supabase
      .from("users")
      .update({ billing_plan: "subscription", subscription_valid_until: until.toISOString() })
      .eq("id", userId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={activate}
      disabled={loading}
      className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
    >
      {t("admin.activateSubscription")}
    </button>
  );
}
