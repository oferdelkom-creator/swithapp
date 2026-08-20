"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import type { DealerFeatureRequestStatus } from "@/lib/types";

const STATUSES: DealerFeatureRequestStatus[] = ["new", "reviewing", "planned", "released", "declined"];

export default function FeatureRequestActions({
  requestId,
  initialStatus,
  initialNote,
}: {
  requestId: string;
  initialStatus: DealerFeatureRequestStatus;
  initialNote: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("dealer_feature_requests")
      .update({ status, admin_note: note.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", requestId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
      <select value={status} onChange={(event) => setStatus(event.target.value as DealerFeatureRequestStatus)} className="field text-sm">
        {STATUSES.map((value) => <option key={value} value={value}>{t(`featureRequestStatus.${value}`)}</option>)}
      </select>
      <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder={t("admin.featureRequestNote")} className="field text-sm" />
      <button type="button" onClick={save} disabled={saving} className="btn-secondary text-sm">
        {saving ? t("carForm.saving") : t("admin.featureRequestSave")}
      </button>
      {error && <p className="text-xs text-red-600 sm:col-span-3">{error}</p>}
    </div>
  );
}
