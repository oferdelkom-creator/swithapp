import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import DealerDeck from "./DealerDeck";

export default async function DealerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/d/${slug}`);

  const { data: dealer } = await supabase
    .from("users")
    .select("id, name, business_name, role")
    .eq("dealer_slug", slug)
    .maybeSingle<{ id: string; name: string; business_name: string | null; role: string }>();

  if (!dealer || (dealer.role !== "dealer" && dealer.role !== "importer")) notFound();
  if (dealer.id === user.id) redirect("/business");

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{dealer.business_name || dealer.name}</h1>
        <p className="text-neutral-500 text-sm">{t("dealerPage.subtitle")}</p>
      </div>
      <DealerDeck userId={user.id} dealerId={dealer.id} />
    </div>
  );
}
