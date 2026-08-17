import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { toWhatsAppLink } from "@/lib/phone";
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
  dealer_address: string | null;
}

interface DealerPublicStats {
  active_listings: number;
  completed_matches: number;
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
    .select(
      "id, name, business_name, role, logo_url, cover_photo_url, dealer_description, public_phone, dealer_address"
    )
    .eq("dealer_slug", slug)
    .maybeSingle<Dealer>();

  if (!dealer || (dealer.role !== "dealer" && dealer.role !== "importer")) notFound();
  if (user && dealer.id === user.id) redirect("/business");

  const { data: statsRows } = await supabase.rpc("get_dealer_public_stats", { p_dealer_id: dealer.id });
  const stats = (statsRows as DealerPublicStats[] | null)?.[0] ?? null;

  const displayName = dealer.business_name || dealer.name;

  return (
    <div className="max-w-md mx-auto pb-28">
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
          {dealer.dealer_address && (
            <p className="text-neutral-500 text-xs mt-1 flex items-center gap-1">
              <PinIcon /> {dealer.dealer_address}
            </p>
          )}

          {stats && (stats.active_listings > 0 || stats.completed_matches > 0) && (
            <div className="flex gap-2 mt-4">
              <div className="flex-1 rounded-xl bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-brand-pink">{stats.active_listings}</p>
                <p className="text-[11px] text-neutral-500">{t("dealerPage.statActiveListings")}</p>
              </div>
              <div className="flex-1 rounded-xl bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-brand-pink">{stats.completed_matches}</p>
                <p className="text-[11px] text-neutral-500">{t("dealerPage.statDeals")}</p>
              </div>
            </div>
          )}
        </div>

        <DealerPageTabs userId={user?.id ?? null} dealerId={dealer.id} />
      </div>

      {dealer.public_phone && (
        <div
          className={`fixed inset-x-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] ${
            user ? "bottom-16" : "bottom-0"
          }`}
        >
          <div className="max-w-md mx-auto flex gap-2">
            <a href={`tel:${dealer.public_phone}`} className="btn-secondary flex-1 text-center text-sm">
              {t("dealerPage.call")}
            </a>
            <a
              href={toWhatsAppLink(dealer.public_phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] text-white text-sm px-4 py-2 font-medium hover:bg-[#1fb855] transition-colors"
            >
              <WhatsAppIcon /> {t("dealerPage.whatsapp")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}


function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.07c-.24.68-1.4 1.3-1.93 1.34-.5.05-1.02.26-3.42-.72-2.9-1.19-4.77-4.14-4.92-4.33-.14-.19-1.18-1.57-1.18-2.99 0-1.42.75-2.12 1.01-2.41.26-.29.58-.36.77-.36l.55.01c.18 0 .41-.07.64.49.24.58.81 1.99.88 2.14.07.14.11.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.44.2.51.31.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}
