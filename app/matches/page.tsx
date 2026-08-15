import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";

type MatchRow = {
  id: string;
  status: string;
  created_at: string;
  user_a_id: string;
  user_b_id: string;
  user_a: { name: string } | null;
  user_b: { name: string } | null;
  car_a: { make: string; model: string } | null;
  car_b: { make: string; model: string } | null;
};

export default async function MatchesPage() {
  const supabase = await createClient();
  const { t, locale } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/matches");

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, created_at, user_a_id, user_b_id, user_a:users!matches_user_a_id_fkey(name), user_b:users!matches_user_b_id_fkey(name), car_a:cars!matches_user_a_car_id_fkey(make, model), car_b:cars!matches_user_b_car_id_fkey(make, model)"
    )
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .returns<MatchRow[]>();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">{t("matches.title")}</h1>
      <div className="space-y-3">
        {matches?.length ? (
          matches.map((m) => {
            const isUserA = m.user_a_id === user.id;
            const otherName = isUserA ? m.user_b?.name : m.user_a?.name;
            const myCar = isUserA ? m.car_a : m.car_b;
            const otherCar = isUserA ? m.car_b : m.car_a;
            const dealLabel =
              myCar && otherCar
                ? t("matches.swapLabel", {
                    myMake: myCar.make,
                    myModel: myCar.model,
                    otherMake: otherCar.make,
                    otherModel: otherCar.model,
                  })
                : otherCar
                  ? t("matches.saleLabel", { make: otherCar.make, model: otherCar.model })
                  : myCar
                    ? t("matches.saleLabel", { make: myCar.make, model: myCar.model })
                    : null;
            return (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="block card px-6 py-4 hover:border-brand-blue"
              >
                <p className="font-medium">{otherName ?? t("matches.user")}</p>
                {dealLabel && <p className="text-sm text-muted">{dealLabel}</p>}
                <p className="text-sm text-muted">
                  {m.status === "negotiating" ? t("matches.negotiating") : t("matches.closed")} ·{" "}
                  {formatDate(m.created_at, locale)}
                </p>
              </Link>
            );
          })
        ) : (
          <p className="text-neutral-500 text-sm">{t("matches.empty")}</p>
        )}
      </div>
    </div>
  );
}
