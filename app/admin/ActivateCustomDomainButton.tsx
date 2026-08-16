"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// custom_domain_active is admin-only (protect_privileged_user_columns()) - a dealer
// can enter their domain from /business, but it only actually starts routing once
// this is flipped, which should only happen after the domain has genuinely been added
// to the Vercel project and its DNS verified (see README) - not automatic here.
export default function ActivateCustomDomainButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function activate() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("users").update({ custom_domain_active: true }).eq("id", userId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={activate}
      disabled={loading}
      className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
    >
      {t("admin.activateCustomDomain")}
    </button>
  );
}
