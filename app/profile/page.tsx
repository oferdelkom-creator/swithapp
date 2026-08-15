import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { AppUser } from "@/lib/types";
import ProfileForm from "./ProfileForm";
import BlockedUsersList from "./BlockedUsersList";

type BlockedRow = { blocked_id: string; blocked: { name: string } | null };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [{ data: me }, { data: blocked }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle<AppUser>(),
    supabase
      .from("blocks")
      .select("blocked_id, blocked:users!blocks_blocked_id_fkey(name)")
      .eq("blocker_id", user.id)
      .returns<BlockedRow[]>(),
  ]);

  if (!me) redirect("/");

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">{t("profile.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{t("profile.subtitle")}</p>
      <div className="space-y-8">
        <ProfileForm user={me} />
        <BlockedUsersList blocked={blocked ?? []} />
      </div>
    </div>
  );
}
