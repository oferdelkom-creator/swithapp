"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { dealerSignupDraft } from "@/lib/signupAuth";
import { finishDealerSignup } from "@/lib/dealerSignup";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";

export default function FinishSignup() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/business/login?next=/business/join/finish");
        return;
      }

      // Metadata is only an untrusted signup draft; strict parsing never permits admin roles.
      // Legacy links retain a validated fallback, but new emails contain no business PII.
      const draft = dealerSignupDraft(user.user_metadata?.dealer_signup ?? {
        businessName: searchParams.get("business_name") ?? "",
        cap: searchParams.get("cap") === "1" ? 1 : searchParams.get("cap") === "0" ? 0 : null,
        phone: searchParams.get("phone") ?? "",
        role: searchParams.get("role") ?? "dealer",
        dealerSlug: searchParams.get("dealer_slug") ?? "",
        customDomain: searchParams.get("custom_domain") || null,
      });
      const { businessName, cap, phone, role, dealerSlug, customDomain } = draft;
      const shouldSetPassword = searchParams.get("set_password") === "1";

      await finishDealerSignup(supabase, { userId: user.id, businessName, cap, phone, role, dealerSlug, customDomain });
      await fetch("/api/notifications/new-customer", { method: "POST", signal: AbortSignal.timeout(8000) }).catch(() => undefined);
      trackMarketingEvent("partner_signup_complete", { business_type: role, tier: cap ?? "custom" });
      router.push(shouldSetPassword ? "/business/set-password" : cap === 1 ? "/business" : "/business/billing");
      router.refresh();
    }
    run().catch(() => setError("לא ניתן לאשר את השלמת פרטי העסק. אין לנסות שוב אוטומטית; פנו לתמיכה. לא בוצע חיוב."));
  }, [router, searchParams]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="card p-8">
        <p className="text-neutral-500">{error ?? t("businessJoin.finishing")}</p>
      </div>
    </div>
  );
}
