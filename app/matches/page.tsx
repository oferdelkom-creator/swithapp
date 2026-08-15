import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <h1 className="text-2xl font-semibold mb-6">התאמות</h1>
      <div className="space-y-3">
        {matches?.length ? (
          matches.map((m) => {
            const isUserA = m.user_a_id === user.id;
            const otherName = isUserA ? m.user_b?.name : m.user_a?.name;
            const myCar = isUserA ? m.car_a : m.car_b;
            const otherCar = isUserA ? m.car_b : m.car_a;
            const dealLabel =
              myCar && otherCar
                ? `החלפה: ${myCar.make} ${myCar.model} ↔ ${otherCar.make} ${otherCar.model}`
                : otherCar
                  ? `מכירה: ${otherCar.make} ${otherCar.model}`
                  : myCar
                    ? `מכירה: ${myCar.make} ${myCar.model}`
                    : null;
            return (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="block card px-6 py-4 hover:border-brand-blue"
              >
                <p className="font-medium">{otherName ?? "משתמש"}</p>
                {dealLabel && <p className="text-sm text-muted">{dealLabel}</p>}
                <p className="text-sm text-muted">
                  {m.status === "negotiating" ? "בתקשורת" : "סגור"} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("he-IL")}
                </p>
              </Link>
            );
          })
        ) : (
          <p className="text-neutral-500 text-sm">אין התאמות עדיין. עברו למסך הסווייפ.</p>
        )}
      </div>
    </div>
  );
}
