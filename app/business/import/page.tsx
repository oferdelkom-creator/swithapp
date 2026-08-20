import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import InventoryImport from "./InventoryImport";

export default async function InventoryImportPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/business/import");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (!profile || (profile.role !== "dealer" && profile.role !== "importer")) redirect("/");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("inventoryImport.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("inventoryImport.description")}</p>
      <InventoryImport userId={user.id} />
    </div>
  );
}
