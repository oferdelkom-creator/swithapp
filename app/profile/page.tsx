import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { AppUser } from "@/lib/types";
import ProfileForm from "./ProfileForm";
import BlockedUsersList from "./BlockedUsersList";
import ProfileStats, { type Stats } from "./ProfileStats";

type BlockedRow = { blocked_id: string; blocked: { name: string } | null };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [{ data: me }, { data: blocked }, { data: statsRows }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle<AppUser>(),
    supabase
      .from("blocks")
      .select("blocked_id, blocked:users!blocks_blocked_id_fkey(name)")
      .eq("blocker_id", user.id)
      .returns<BlockedRow[]>(),
    supabase.rpc("get_profile_stats", { my_id: user.id }),
  ]);

  if (!me) redirect("/");

  const stats = (statsRows as Stats[] | null)?.[0] ?? null;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">{t("profile.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{t("profile.subtitle")}</p>
      <div className="space-y-8">
        {stats && <ProfileStats stats={stats} />}
        <ProfileForm user={me} />
        <BlockedUsersList blocked={blocked ?? []} />
      </div>
    </div>
  );
}
