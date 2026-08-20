"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import type { DealerFeatureRequest } from "@/lib/types";
import { safeExtension } from "@/lib/storage";

const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export default function FeatureRequestCard({
  userId,
  initialRequests,
}: {
  userId: string;
  initialRequests: DealerFeatureRequest[];
}) {
  const { t } = useLocale();
  const [siteUrl, setSiteUrl] = useState("");
  const [requestedChange, setRequestedChange] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [allowSiteAnalysis, setAllowSiteAnalysis] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (requestedChange.trim().length < 10) return;
    setSaving(true);
    setMessage(null);
    const normalizedSiteUrl = siteUrl.trim()
      ? (siteUrl.trim().match(/^https?:\/\//i) ? siteUrl.trim() : `https://${siteUrl.trim()}`)
      : null;
    const supabase = createClient();
    let referenceLogoUrl: string | null = null;
    if (logoFile) {
      if (!ALLOWED_LOGO_TYPES.has(logoFile.type) || logoFile.size > 5 * 1024 * 1024) {
        setSaving(false);
        setMessage(t("business.featureRequestLogoError"));
        return;
      }
      const path = `${userId}/feature-request-${crypto.randomUUID()}${safeExtension(logoFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, logoFile, { contentType: logoFile.type });
      if (uploadError) {
        setSaving(false);
        setMessage(uploadError.message);
        return;
      }
      referenceLogoUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase
      .from("dealer_feature_requests")
      .insert({
        user_id: userId,
        site_url: normalizedSiteUrl,
        reference_logo_url: referenceLogoUrl,
        allow_site_analysis: allowSiteAnalysis && !!normalizedSiteUrl,
        requested_change: requestedChange.trim(),
      })
      .select("*")
      .single<DealerFeatureRequest>();
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRequests((current) => [data, ...current]);
    setSiteUrl("");
    setRequestedChange("");
    setLogoFile(null);
    setAllowSiteAnalysis(false);
    setMessage(t("business.featureRequestSuccess"));
  }

  return (
    <section className="card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{t("business.featureRequestTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("business.featureRequestDescription")}</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("business.featureRequestSite")}</label>
          <input
            type="text"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            placeholder="https://www.my-dealership.co.il"
            className="field"
            dir="ltr"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("business.featureRequestLogo")}</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            className="field text-sm"
          />
          <p className="mt-1 text-xs text-muted">{t("business.featureRequestLogoHint")}</p>
        </div>
        <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={allowSiteAnalysis}
            disabled={!siteUrl.trim()}
            onChange={(event) => setAllowSiteAnalysis(event.target.checked)}
            className="mt-1"
          />
          <span>{t("business.featureRequestAnalysisConsent")}</span>
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("business.featureRequestChange")}</label>
          <textarea
            required
            minLength={10}
            maxLength={3000}
            rows={4}
            value={requestedChange}
            onChange={(event) => setRequestedChange(event.target.value)}
            placeholder={t("business.featureRequestPlaceholder")}
            className="field resize-y"
          />
        </div>
        <button type="submit" disabled={saving || requestedChange.trim().length < 10} className="btn-primary text-sm">
          {saving ? t("carForm.saving") : t("business.featureRequestSubmit")}
        </button>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </form>

      {requests.length > 0 && (
        <div className="space-y-2 border-t border-neutral-100 pt-4">
          <p className="text-sm font-medium">{t("business.featureRequestHistory")}</p>
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap">{request.requested_change}</p>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-neutral-600">
                  {t(`featureRequestStatus.${request.status}`)}
                </span>
              </div>
              {request.admin_note && <p className="mt-2 text-xs text-neutral-500">{request.admin_note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
