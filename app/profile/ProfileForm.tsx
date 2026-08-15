"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { safeExtension } from "@/lib/storage";
import type { AppUser } from "@/lib/types";

export default function ProfileForm({ user }: { user: AppUser }) {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyOnMatch, setNotifyOnMatch] = useState(user.notify_on_match);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${user.id}/${crypto.randomUUID()}${safeExtension(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setAvatarUrl(data.publicUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("users").update({ name }).eq("id", user.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function enableNotifications() {
    setNotifyError(null);
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyError(t("profile.notificationsUnsupported"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotifyError(t("profile.notificationsDenied"));
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ notify_on_match: true })
      .eq("id", user.id);
    if (updateError) {
      setNotifyError(updateError.message);
      return;
    }
    setNotifyOnMatch(true);
    router.refresh();
  }

  async function disableNotifications() {
    const supabase = createClient();
    await supabase.from("users").update({ notify_on_match: false }).eq("id", user.id);
    setNotifyOnMatch(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-neutral-100 shrink-0 flex items-center justify-center text-neutral-400 text-2xl">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <label className="btn-secondary text-sm cursor-pointer inline-block">
              {uploading ? t("carForm.uploading") : t("profile.changePhoto")}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("profile.name")}</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t("carForm.saving") : t("profile.save")}
          </button>
        </form>
      </div>

      <div className="card p-6 space-y-2">
        <h2 className="font-medium">{t("profile.notificationsTitle")}</h2>
        <p className="text-sm text-muted">{t("profile.notificationsDescription")}</p>
        {notifyOnMatch ? (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-emerald-700 font-medium">{t("profile.notificationsOn")}</span>
            <button onClick={disableNotifications} className="btn-secondary text-sm">
              {t("profile.notificationsTurnOff")}
            </button>
          </div>
        ) : (
          <button onClick={enableNotifications} className="btn-primary text-sm mt-2">
            {t("profile.notificationsEnable")}
          </button>
        )}
        {notifyError && <p className="text-sm text-red-600">{notifyError}</p>}
      </div>
    </div>
  );
}
