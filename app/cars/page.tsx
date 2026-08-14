import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import CarForm from "./CarForm";
import DeleteCarButton from "./DeleteCarButton";

export default async function CarsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cars");

  const { data: cars } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Car[]>();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-1">הרכבים שלי</h1>
        <p className="text-neutral-500">מודעות שאחרים יראו במסך הסווייפ.</p>
      </div>

      <section>
        <h2 className="font-medium mb-4">הוספת רכב</h2>
        <CarForm />
      </section>

      <section>
        <h2 className="font-medium mb-4">המודעות שלי ({cars?.length ?? 0})</h2>
        <div className="space-y-4">
          {cars?.length ? (
            cars.map((c) => (
              <div key={c.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {c.make} {c.model} {c.year ?? ""}
                    </p>
                    <p className="text-sm text-muted">
                      {c.for_sale ? "למכירה" : ""}
                      {c.for_sale && c.for_swap ? " · " : ""}
                      {c.for_swap ? "להחלפה" : ""}
                      {c.price ? ` · ₪${c.price}` : ""}
                      {c.for_swap && c.want_make ? ` · מחפש: ${c.want_make} ${c.want_model ?? ""}` : ""}
                    </p>
                  </div>
                  <DeleteCarButton carId={c.id} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-sm">עדיין אין לך מודעות רכב.</p>
          )}
        </div>
      </section>
    </div>
  );
}
