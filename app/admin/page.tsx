import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import type { AppUser, Car, Message } from "@/lib/types";
import UserBanButton from "./UserBanButton";
import GrantPremiumButton from "./GrantPremiumButton";
import ActivateSubscriptionButton from "./ActivateSubscriptionButton";
import CarAdminActions from "./CarAdminActions";
import ReportActions from "./ReportActions";
import RemoveSeedDataButton from "./RemoveSeedDataButton";

type CarRow = Car & { users: { name: string } | null };
type ReportRow = Message & {
  sender: { name: string } | null;
  matches: { user_a_id: string; user_b_id: string } | null;
};

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

  const [{ data: users }, { data: cars }, { data: reports }, { count: seedUserCount }] = await Promise.all([
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
  ]);

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
                  <td className="py-2 pe-4">{u.business_name ?? "-"}</td>
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
