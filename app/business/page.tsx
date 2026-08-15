import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";

export default async function BusinessPage() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/business");

  const { data: me } = await supabase
    .from("users")
    .select("role, business_name, billing_plan, subscription_valid_until")
    .eq("id", user.id)
    .maybeSingle<{
      role: string;
      business_name: string | null;
      billing_plan: string | null;
      subscription_valid_until: string | null;
    }>();

  if (!me || (me.role !== "dealer" && me.role !== "importer")) redirect("/");

  const active = me.subscription_valid_until && new Date(me.subscription_valid_until) > new Date();

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">{t("business.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{me.business_name ?? "-"}</p>

      <div className="card p-6 space-y-2 text-sm">
        <p>{t("business.plan", { plan: me.billing_plan ?? t("business.notSet") })}</p>
        <p>
          {t("business.subscription")}{" "}
          {active ? (
            <span className="text-emerald-700 font-medium">
              {t("business.activeUntil", { date: formatDate(me.subscription_valid_until!, locale) })}
            </span>
          ) : (
            <span className="text-red-600 font-medium">{t("business.inactive")}</span>
          )}
        </p>
        <p className="text-neutral-500 pt-2">{t("business.noSelfServe")}</p>
      </div>
    </div>
  );
}
