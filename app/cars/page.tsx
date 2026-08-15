import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { Car } from "@/lib/types";
import CarForm from "./CarForm";
import DeleteCarButton from "./DeleteCarButton";
import MarkSoldButton from "./MarkSoldButton";

export default async function CarsPage() {
  const supabase = await createClient();
  const { t } = await getT();
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
        <h1 className="text-2xl font-semibold mb-1">{t("cars.title")}</h1>
        <p className="text-neutral-500">{t("cars.subtitle")}</p>
      </div>

      <section>
        <h2 className="font-medium mb-4">{t("cars.addTitle")}</h2>
        <CarForm />
      </section>

      <section>
        <h2 className="font-medium mb-4">{t("cars.myListings", { count: cars?.length ?? 0 })}</h2>
        <div className="space-y-4">
          {cars?.length ? (
            cars.map((c) => (
              <div key={c.id} className={`card p-5 flex items-start gap-4 ${c.sold_at ? "opacity-60" : ""}`}>
                {c.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_urls[0]} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-neutral-100 shrink-0" />
                )}
                <div className="flex-1 flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {c.make} {c.model} {c.year ?? ""}
                    </p>
                    <p className="text-sm text-muted">
                      {c.sold_at && (
                        <span className="text-neutral-700 font-medium">{t("cars.sold")}</span>
                      )}
                      {c.sold_at && (c.for_sale || c.for_swap) ? " · " : ""}
                      {c.for_sale ? t("cars.forSale") : ""}
                      {c.for_sale && c.for_swap ? " · " : ""}
                      {c.for_swap ? t("cars.forSwap") : ""}
                      {c.price ? ` · ₪${c.price}` : ""}
                      {c.for_swap && c.want_make
                        ? ` · ${t("cars.looking", { make: c.want_make, model: c.want_model ?? "" })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/cars/${c.id}/edit`} className="text-xs text-brand-blue underline">
                      {t("cars.edit")}
                    </Link>
                    {!c.sold_at && <MarkSoldButton carId={c.id} />}
                    <DeleteCarButton carId={c.id} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-sm">{t("cars.empty")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
