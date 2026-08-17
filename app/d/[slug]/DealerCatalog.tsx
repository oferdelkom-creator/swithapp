"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { VehicleType } from "@/lib/types";

interface DealerCar {
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  category: VehicleType;
  price: number | null;
  photo_urls: string[];
  for_sale: boolean;
  for_swap: boolean;
}

const BUDGETS = [50000, 100000, 200000];

export default function DealerCatalog({ userId, dealerId }: { userId: string | null; dealerId: string }) {
  const { t } = useLocale();
  const [cars, setCars] = useState<DealerCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("dealer_inventory", { my_id: userId, p_dealer_id: dealerId });
      setCars((data as DealerCar[]) ?? []);
      setLoading(false);
    }
    load();
  }, [userId, dealerId]);

  if (loading) return <p className="text-neutral-500 text-sm">{t("swipe.loading")}</p>;
  if (!cars.length) return <p className="text-neutral-500 text-sm">{t("dealerPage.catalogEmpty")}</p>;

  const filtered = maxBudget === null ? cars : cars.filter((c) => c.price != null && c.price <= maxBudget);

  return (
    <div>
      <div className="flex gap-2 mb-3 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMaxBudget(null)}
          className={maxBudget === null ? "shrink-0 chip-active px-3 py-1.5" : "shrink-0 chip-inactive px-3 py-1.5"}
        >
          {t("dealerPage.budgetAll")}
        </button>
        {BUDGETS.map((b) => (
          <button
            key={b}
            onClick={() => setMaxBudget(b)}
            className={maxBudget === b ? "shrink-0 chip-active px-3 py-1.5" : "shrink-0 chip-inactive px-3 py-1.5"}
          >
            {t("dealerPage.budgetUpTo", { amount: b.toLocaleString() })}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((car) => (
            <Link key={car.car_id} href={`/cars/${car.car_id}`} className="card overflow-hidden">
              <div className="relative aspect-square bg-neutral-200">
                {car.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={car.photo_urls[0]}
                    alt={`${car.make} ${car.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                    {t("swipe.noPhoto")}
                  </div>
                )}
                {car.category !== "car" && (
                  <span className="absolute top-2 start-2 rounded-full bg-white/90 text-neutral-900 text-[10px] font-medium px-2 py-0.5">
                    {t(VEHICLE_TYPES.find((vt) => vt.value === car.category)?.labelKey ?? "vehicleType.car")}
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium truncate">
                  {car.make} {car.model} {car.year ?? ""}
                </p>
                <p className="text-xs text-neutral-500">{car.price ? `₪${car.price}` : t("swipe.noPriceListed")}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-sm">{t("dealerPage.catalogEmpty")}</p>
      )}
    </div>
  );
}
