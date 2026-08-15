"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// No payment gateway is wired up yet (same gap as the hotel-trust sibling) - premium is
// granted by an admin for now, 30 days at a time.
export default function GrantPremiumButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function grant() {
    setLoading(true);
    const supabase = createClient();
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await supabase.from("users").update({ premium_until: until.toISOString() }).eq("id", userId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={grant}
      disabled={loading}
      className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
    >
      {t("admin.grantPremium")}
    </button>
  );
}
