"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { finishDealerSignup } from "@/lib/dealerSignup";
import { trackSignupFunnel } from "@/lib/signupFunnel";

export default function FinishSignup() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?next=/business/join");
        return;
      }

      const businessName = searchParams.get("business_name") ?? "";
      const capParam = searchParams.get("cap");
      const cap = capParam ? Number(capParam) : null;
      const phone = searchParams.get("phone") ?? "";
      const role = searchParams.get("role") === "importer" ? "importer" : "dealer";
      const dealerSlug = searchParams.get("dealer_slug") ?? "";
      const customDomain = searchParams.get("custom_domain") || null;

      await finishDealerSignup(supabase, { userId: user.id, businessName, cap, phone, role, dealerSlug, customDomain });
      await fetch("/api/notifications/new-customer", { method: "POST" }).catch(() => undefined);
      trackSignupFunnel("dealer_signup_complete", { completion_path: "email_confirmation", role });
      router.push("/business");
      router.refresh();
    }
    run().catch((err) => {
      trackSignupFunnel("dealer_signup_submit_failure", { stage: "confirmation", reason: "profile_creation_failed" });
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [router, searchParams]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="card p-8">
        <p className="text-neutral-500">{error ?? t("businessJoin.finishing")}</p>
      </div>
    </div>
  );
}
