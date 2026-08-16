import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import DealerPageTabs from "./DealerPageTabs";

interface Dealer {
  id: string;
  name: string;
  business_name: string | null;
  role: string;
  logo_url: string | null;
  cover_photo_url: string | null;
  dealer_description: string | null;
  public_phone: string | null;
}

export default async function DealerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dealer } = await supabase
    .from("users")
    .select("id, name, business_name, role, logo_url, cover_photo_url, dealer_description, public_phone")
    .eq("dealer_slug", slug)
    .maybeSingle<Dealer>();

  if (!dealer || (dealer.role !== "dealer" && dealer.role !== "importer")) notFound();
  if (user && dealer.id === user.id) redirect("/business");

  const displayName = dealer.business_name || dealer.name;

  return (
    <div className="max-w-md mx-auto pb-6">
      <div className="relative h-40 bg-gradient-to-br from-brand-blue to-brand-blue-dark">
        {dealer.cover_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dealer.cover_photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      <div className="px-4">
        <div className="-mt-10 flex items-end gap-3">
          {dealer.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dealer.logo_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md bg-white"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-neutral-100 flex items-center justify-center text-2xl text-neutral-400">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="mt-3 mb-4">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-neutral-500 text-sm">{dealer.dealer_description || t("dealerPage.subtitle")}</p>
          {dealer.public_phone && (
            <a href={`tel:${dealer.public_phone}`} className="btn-secondary text-sm inline-block mt-3">
              {t("dealerPage.callUs", { phone: dealer.public_phone })}
            </a>
          )}
        </div>

        <DealerPageTabs userId={user?.id ?? null} dealerId={dealer.id} slug={slug} />
      </div>
    </div>
  );
}
