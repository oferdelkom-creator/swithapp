import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import type { AppUser, Car, DealerFeatureRequest, Message } from "@/lib/types";
import UserBanButton from "./UserBanButton";
import GrantPremiumButton from "./GrantPremiumButton";
import ActivateSubscriptionButton from "./ActivateSubscriptionButton";
import ActivateCustomDomainButton from "./ActivateCustomDomainButton";
import CarAdminActions from "./CarAdminActions";
import ReportActions from "./ReportActions";
import RemoveSeedDataButton from "./RemoveSeedDataButton";
import FeatureRequestActions from "./FeatureRequestActions";
import { tierForRequestedCap } from "@/lib/dealerPricing";

type CarRow = Car & { users: { name: string } | null };
type ReportRow = Message & {
  sender: { name: string } | null;
  matches: { user_a_id: string; user_b_id: string } | null;
};
type FeatureRequestRow = DealerFeatureRequest & {
  users: { name: string; business_name: string | null } | null;
};

type TelegramDealerAccount = {
  telegram_user_id: number;
  role: "dealer" | "importer";
  business_name: string;
  legal_name: string | null;
  tax_id: string | null;
  city: string;
  phone: string;
  inventory_mode: "manual" | "csv" | "xml" | "api";
  verified: boolean;
  trial_ends_at: string;
  created_at: string;
};

async function getTelegramDealerOverview() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) return { accounts: [] as TelegramDealerAccount[], vehicles: [] as { seller_telegram_user_id: number }[], leads: [] as { dealer_telegram_user_id: number }[] };
  const service = createServiceClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: accounts }, { data: vehicles }, { data: leads }] = await Promise.all([
    service.from("telegram_dealer_accounts").select("telegram_user_id,role,business_name,legal_name,tax_id,city,phone,inventory_mode,verified,trial_ends_at,created_at").order("created_at", { ascending: false }).limit(500),
    service.from("market_vehicle_inventory").select("seller_telegram_user_id").eq("source_name", "telegram_dealer").eq("market_country", "RU"),
    service.from("telegram_dealer_leads").select("dealer_telegram_user_id"),
  ]);
  return {
    accounts: (accounts ?? []) as TelegramDealerAccount[],
    vehicles: (vehicles ?? []) as { seller_telegram_user_id: number }[],
    leads: (leads ?? []) as { dealer_telegram_user_id: number }[],
  };
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!me?.is_admin) redirect("/");

  const [{ data: users }, { data: cars }, { data: reports }, { count: seedUserCount }, { data: featureRequests }, telegramDealers] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("is_seed", false)
      .order("created_at", { ascending: false })
      .returns<AppUser[]>(),
    supabase
      .from("cars")
      .select("*, users(name)")
      .eq("is_seed", false)
      .order("created_at", { ascending: false })
      .returns<CarRow[]>(),
    supabase
      .from("messages")
      .select("*, sender:users!messages_sender_id_fkey(name), matches(user_a_id, user_b_id)")
      .eq("kind", "report")
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("is_seed", true),
    supabase
      .from("dealer_feature_requests")
      .select("*, users(name, business_name)")
      .order("created_at", { ascending: false })
      .returns<FeatureRequestRow[]>(),
    getTelegramDealerOverview(),
  ]);

  const vehicleCounts = new Map<number, number>();
  const leadCounts = new Map<number, number>();
  telegramDealers.vehicles.forEach(({ seller_telegram_user_id }) => vehicleCounts.set(seller_telegram_user_id, (vehicleCounts.get(seller_telegram_user_id) ?? 0) + 1));
  telegramDealers.leads.forEach(({ dealer_telegram_user_id }) => leadCounts.set(dealer_telegram_user_id, (leadCounts.get(dealer_telegram_user_id) ?? 0) + 1));
  const now = Date.now();
  const newDealerCount = telegramDealers.accounts.filter((account) => now - new Date(account.created_at).getTime() <= 24 * 60 * 60 * 1000).length;
  const activeTrialCount = telegramDealers.accounts.filter((account) => new Date(account.trial_ends_at).getTime() > now).length;

  const twoMinutesAgo = new Date();
  twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t("admin.title")}</h1>
        <p className="text-neutral-500">{t("admin.subtitle")}</p>
      </div>

      {!!seedUserCount && (
        <section className="card px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-medium">{t("admin.seedDataTitle", { count: seedUserCount })}</p>
            <p className="text-sm text-muted mt-1">{t("admin.seedDataDescription")}</p>
          </div>
          <RemoveSeedDataButton />
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">סוחרים ויבואנים — Telegram רוסיה</h2>
            <p className="mt-1 text-sm text-neutral-500">הרשמות, מלאי, לידים ותקופת הניסיון במקום אחד.</p>
          </div>
          {newDealerCount > 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">{newDealerCount} הרשמות חדשות ב־24 שעות</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["חשבונות", telegramDealers.accounts.length],
            ["בתקופת ניסיון", activeTrialCount],
            ["כלי רכב", telegramDealers.vehicles.length],
            ["לידים", telegramDealers.leads.length],
          ].map(([label, value]) => (
            <div key={label} className="card px-5 py-4"><p className="text-sm text-neutral-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[980px] text-sm border-collapse">
            <thead><tr className="border-b border-neutral-200 bg-neutral-50 text-right text-neutral-500">
              <th className="px-4 py-3">עסק</th><th className="px-4 py-3">תפקיד</th><th className="px-4 py-3">עיר</th><th className="px-4 py-3">טלפון</th><th className="px-4 py-3">מלאי</th><th className="px-4 py-3">לידים</th><th className="px-4 py-3">ניסיון</th><th className="px-4 py-3">אימות</th><th className="px-4 py-3">נרשם</th>
            </tr></thead>
            <tbody>
              {telegramDealers.accounts.length ? telegramDealers.accounts.map((account) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(account.trial_ends_at).getTime() - now) / (24 * 60 * 60 * 1000)));
                return <tr key={account.telegram_user_id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3"><span className="font-medium">{account.business_name}</span><span className="block text-xs text-neutral-400">{account.legal_name ?? `Telegram ${account.telegram_user_id}`}{account.tax_id ? ` · ИНН ${account.tax_id}` : ""}</span></td>
                  <td className="px-4 py-3">{account.role === "importer" ? "יבואן" : "סוחר"}</td>
                  <td className="px-4 py-3">{account.city}</td><td className="px-4 py-3" dir="ltr">{account.phone}</td>
                  <td className="px-4 py-3">{vehicleCounts.get(account.telegram_user_id) ?? 0}<span className="block text-xs text-neutral-400">{account.inventory_mode.toUpperCase()}</span></td>
                  <td className="px-4 py-3">{leadCounts.get(account.telegram_user_id) ?? 0}</td>
                  <td className="px-4 py-3">{daysLeft > 0 ? `${daysLeft} ימים` : "הסתיים"}</td>
                  <td className="px-4 py-3">{account.verified ? <span className="text-emerald-700">מאומת</span> : <span className="text-amber-700">ממתין</span>}</td>
                  <td className="px-4 py-3">{formatDate(account.created_at, locale)}</td>
                </tr>;
              }) : <tr><td colSpan={9} className="px-4 py-10 text-center text-neutral-500">עדיין אין הרשמות של סוחרים מרוסיה. ההרשמה הראשונה תופיע כאן אוטומטית.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">{t("admin.reports", { count: reports?.length ?? 0 })}</h2>
        <div className="space-y-3">
          {reports?.length ? (
            reports.map((r) => (
              <div key={r.id} className="card px-6 py-5">
                <p className="text-sm text-neutral-500">
                  {t("admin.reportFrom", { name: r.sender?.name ?? t("admin.unknown") })} ·{" "}
                  {formatDateTime(r.created_at, locale)}
                </p>
                <p className="mt-1">{r.text}</p>
                <ReportActions messageId={r.id} senderId={r.sender_id} />
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-sm">{t("admin.reportsEmpty")}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">{t("admin.featureRequests", { count: featureRequests?.length ?? 0 })}</h2>
        <div className="space-y-3">
          {featureRequests?.length ? featureRequests.map((request) => (
            <div key={request.id} className="card px-6 py-5">
              <p className="text-sm text-neutral-500">
                {request.users?.business_name ?? request.users?.name ?? t("admin.unknown")} · {formatDateTime(request.created_at, locale)}
              </p>
              {request.site_url && <a href={request.site_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-brand-blue">{request.site_url}</a>}
              {request.allow_site_analysis && <p className="mt-1 text-xs text-emerald-700">{t("admin.featureRequestAnalysisApproved")}</p>}
              {request.reference_logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.reference_logo_url} alt="" className="mt-3 h-16 w-16 rounded-lg border border-neutral-200 object-contain" />
              )}
              <p className="mt-2 whitespace-pre-wrap">{request.requested_change}</p>
              <FeatureRequestActions requestId={request.id} initialStatus={request.status} initialNote={request.admin_note} />
            </div>
          )) : <p className="text-neutral-500 text-sm">{t("admin.featureRequestsEmpty")}</p>}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">{t("admin.users", { count: users?.length ?? 0 })}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-right text-neutral-500 border-b border-neutral-200">
                <th className="py-2 pe-4">{t("admin.colOnline")}</th>
                <th className="py-2 pe-4">{t("admin.colName")}</th>
                <th className="py-2 pe-4">{t("admin.colRole")}</th>
                <th className="py-2 pe-4">{t("admin.colBusiness")}</th>
                <th className="py-2 pe-4">{t("admin.colPremiumUntil")}</th>
                <th className="py-2 pe-4">{t("admin.colSubscriptionUntil")}</th>
                <th className="py-2 pe-4">{t("admin.colJoined")}</th>
                <th className="py-2 pe-4">{t("admin.colStatus")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => {
                const online = !!u.last_seen_at && new Date(u.last_seen_at) > twoMinutesAgo;
                const requestedTier = tierForRequestedCap(u.requested_car_cap);
                return (
                <tr key={u.id} className="border-b border-neutral-100">
                  <td className="py-2 pe-4">
                    <span
                      title={online ? t("presence.online") : t("presence.offline")}
                      className={`inline-block w-2.5 h-2.5 rounded-full ${online ? "bg-green-500" : "bg-neutral-300"}`}
                    />
                  </td>
                  <td className="py-2 pe-4">{u.name}</td>
                  <td className="py-2 pe-4">{u.role}</td>
                  <td className="py-2 pe-4">
                    {u.business_name ?? "-"}
                    {u.requested_car_cap != null && (
                      <span className="block text-xs text-neutral-400">
                        {requestedTier.cap
                          ? t("businessJoin.tierRange", { min: requestedTier.minCars, max: requestedTier.cap })
                          : t("businessJoin.tierFrom", { count: requestedTier.minCars })}
                      </span>
                    )}
                    {u.custom_domain && (
                      <span className="block text-xs text-neutral-400">
                        {u.custom_domain} {u.custom_domain_active ? "✓" : `(${t("admin.customDomainPending")})`}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-4">
                    {u.premium_until ? formatDate(u.premium_until, locale) : "-"}
                  </td>
                  <td className="py-2 pe-4">
                    {u.subscription_valid_until ? formatDate(u.subscription_valid_until, locale) : "-"}
                  </td>
                  <td className="py-2 pe-4">{formatDate(u.created_at, locale)}</td>
                  <td className="py-2 pe-4">
                    {u.is_admin ? (
                      <span className="text-brand-blue-dark">{t("admin.statusAdmin")}</span>
                    ) : u.is_banned ? (
                      <span className="text-red-600">{t("admin.statusBanned")}</span>
                    ) : (
                      <span className="text-neutral-400">{t("admin.statusActive")}</span>
                    )}
                  </td>
                  <td className="py-2">
                    {!u.is_admin && (
                      <div className="flex gap-2">
                        <UserBanButton userId={u.id} isBanned={u.is_banned} />
                        {u.role === "private" && <GrantPremiumButton userId={u.id} />}
                        {(u.role === "dealer" || u.role === "importer") && (
                          <ActivateSubscriptionButton userId={u.id} />
                        )}
                        {u.custom_domain && !u.custom_domain_active && (
                          <ActivateCustomDomainButton userId={u.id} />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">{t("admin.carListings", { count: cars?.length ?? 0 })}</h2>
        <div className="space-y-2">
          {cars?.map((c) => (
            <div key={c.id} className="flex items-center justify-between card px-6 py-4">
              <div>
                <p className="font-medium">
                  {c.make} {c.model} {c.year ?? ""}
                </p>
                <p className="text-sm text-neutral-500">
                  {c.users?.name ?? t("admin.unknown")} ·{" "}
                  {c.sold_at ? (
                    <span className="text-neutral-700 font-medium">{t("cars.sold")}</span>
                  ) : (
                    <>
                      {c.for_sale ? t("cars.forSale") : ""}
                      {c.for_sale && c.for_swap ? " / " : ""}
                      {c.for_swap ? t("cars.forSwap") : ""}
                    </>
                  )}
                  {c.price ? ` · ₪${c.price}` : ""}
                </p>
              </div>
              <CarAdminActions
                carId={c.id}
                listingFeePaid={c.listing_fee_paid}
                boostedUntil={c.boosted_until}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

