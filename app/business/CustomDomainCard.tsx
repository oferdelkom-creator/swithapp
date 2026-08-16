"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { CUSTOM_DOMAIN_ADDON_PRICE } from "@/lib/dealerPricing";

export default function CustomDomainCard({
  userId,
  initialDomain,
  active,
}: {
  userId: string;
  initialDomain: string | null;
  active: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [saved, setSaved] = useState(initialDomain);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const cleaned = domain.trim().toLowerCase();
    if (!cleaned) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("users")
      .update({ custom_domain: cleaned })
      .eq("id", userId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message.includes("duplicate") ? t("business.customDomainTaken") : saveError.message);
      return;
    }
    setSaved(cleaned);
    router.refresh();
  }

  return (
    <div className="card p-6 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">{t("business.customDomainTitle")}</p>
        <span className="text-xs text-neutral-400">
          {t("business.customDomainAddonPrice", { price: CUSTOM_DOMAIN_ADDON_PRICE })}
        </span>
      </div>
      <p className="text-neutral-500">{t("business.customDomainDescription")}</p>

      {saved && (
        <p className="text-xs">
          {active ? (
            <span className="text-emerald-700 font-medium">{t("business.customDomainActive", { domain: saved })}</span>
          ) : (
            <span className="text-amber-600 font-medium">{t("business.customDomainPending", { domain: saved })}</span>
          )}
        </p>
      )}

      {saved && !active && (
        <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500 space-y-1">
          <p>{t("business.customDomainDnsInstructions")}</p>
          <code className="block rounded bg-neutral-100 px-2 py-1">CNAME → cname.vercel-dns.com</code>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t("business.customDomainPlaceholder")}
          className="field flex-1"
        />
        <button type="button" onClick={save} disabled={saving || !domain.trim()} className="btn-primary text-xs whitespace-nowrap">
          {saving ? t("carForm.saving") : saved ? t("business.updateSlug") : t("business.publish")}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
