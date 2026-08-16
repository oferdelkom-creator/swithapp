"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// ASCII-only, since this becomes a URL path segment - a Hebrew business name just
// won't produce an auto-suggested slug, the dealer types their own in that case.
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PublicPageLink({
  userId,
  initialSlug,
  businessName,
  siteOrigin,
}: {
  userId: string;
  initialSlug: string | null;
  businessName: string | null;
  siteOrigin: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [draft, setDraft] = useState(initialSlug ?? slugify(businessName ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = `${siteOrigin}/d/${slug}`;

  async function save() {
    const cleaned = slugify(draft);
    if (!cleaned) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("users")
      .update({ dealer_slug: cleaned })
      .eq("id", userId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message.includes("duplicate") ? t("business.slugTaken") : saveError.message);
      return;
    }
    setSlug(cleaned);
    setDraft(cleaned);
    router.refresh();
  }

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-6 space-y-3 text-sm">
      <p className="font-medium">{t("business.publicPageTitle")}</p>
      {slug ? (
        <>
          <p className="text-neutral-500">{t("business.publicPageDescription")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-neutral-100 px-3 py-2 text-xs">{url}</code>
            <button type="button" onClick={copy} className="btn-secondary text-xs whitespace-nowrap">
              {copied ? t("business.copied") : t("business.copyLink")}
            </button>
          </div>
        </>
      ) : (
        <p className="text-neutral-500">{t("business.publicPageDescriptionUnset")}</p>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("business.slugPlaceholder")}
          className="field flex-1"
        />
        <button type="button" onClick={save} disabled={saving || !draft.trim()} className="btn-primary text-xs whitespace-nowrap">
          {saving ? t("carForm.saving") : slug ? t("business.updateSlug") : t("business.publish")}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
