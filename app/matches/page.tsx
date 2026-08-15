import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import MatchesList, { type MatchPreview } from "./MatchesList";

export default async function MatchesPage() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/matches");

  const { data: matches } = await supabase.rpc("get_matches_with_previews", { my_id: user.id });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">{t("matches.title")}</h1>
      <MatchesList matches={(matches as MatchPreview[]) ?? []} locale={locale} />
    </div>
  );
}
