"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { safeExtension } from "@/lib/storage";

export default function DealerBrandingCard({
  userId,
  initialLogoUrl,
  initialCoverPhotoUrl,
  initialDescription,
  initialPublicPhone,
  initialAddress,
}: {
  userId: string;
  initialLogoUrl: string | null;
  initialCoverPhotoUrl: string | null;
  initialDescription: string | null;
  initialPublicPhone: string | null;
  initialAddress: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(initialCoverPhotoUrl);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [publicPhone, setPublicPhone] = useState(initialPublicPhone ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File, column: "logo_url" | "cover_photo_url") {
    const setUploading = column === "logo_url" ? setUploadingLogo : setUploadingCover;
    const setUrl = column === "logo_url" ? setLogoUrl : setCoverPhotoUrl;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${userId}/${column}-${crypto.randomUUID()}${safeExtension(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("users")
        .update({ [column]: data.publicUrl })
        .eq("id", userId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setUrl(data.publicUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setUploading(false);
    }
  }

  async function saveDetails() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        dealer_description: description.trim() || null,
        public_phone: publicPhone.trim() || null,
        dealer_address: address.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-6 space-y-4 text-sm">
      <p className="font-medium">{t("business.brandingTitle")}</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-neutral-500 mb-2">{t("business.logo")}</p>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-100 mb-2" />
          )}
          <label className="btn-secondary text-xs cursor-pointer inline-block">
            {uploadingLogo ? t("carForm.uploading") : t("business.uploadLogo")}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingLogo}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadImage(file, "logo_url");
              }}
            />
          </label>
        </div>

        <div>
          <p className="text-xs text-neutral-500 mb-2">{t("business.coverPhoto")}</p>
          {coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhotoUrl} alt="" className="w-full h-16 rounded-lg object-cover mb-2" />
          ) : (
            <div className="w-full h-16 rounded-lg bg-neutral-100 mb-2" />
          )}
          <label className="btn-secondary text-xs cursor-pointer inline-block">
            {uploadingCover ? t("carForm.uploading") : t("business.uploadCover")}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingCover}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadImage(file, "cover_photo_url");
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">{t("business.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("business.descriptionPlaceholder")}
          rows={3}
          className="field w-full"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">{t("business.publicPhone")}</label>
        <input
          value={publicPhone}
          onChange={(e) => setPublicPhone(e.target.value)}
          placeholder={t("business.publicPhonePlaceholder")}
          className="field w-full"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">{t("business.address")}</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("business.addressPlaceholder")}
          className="field w-full"
        />
      </div>

      <button type="button" onClick={saveDetails} disabled={saving} className="btn-primary text-xs">
        {saving ? t("carForm.saving") : t("business.saveBranding")}
      </button>

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
