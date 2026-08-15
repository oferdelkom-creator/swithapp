import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { AppUser } from "@/lib/types";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data: me } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<AppUser>();

  if (!me) redirect("/");

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">{t("profile.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{t("profile.subtitle")}</p>
      <ProfileForm user={me} />
    </div>
  );
}
