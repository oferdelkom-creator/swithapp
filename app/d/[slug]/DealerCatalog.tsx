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

const STANDARD_BUDGETS = [50000, 100000, 200000];
const LUXURY_BUDGETS = [1000000, 1500000, 2000000, 3500000];

function formatPrice(price: number) {
  return `₪${price.toLocaleString("he-IL")}`;
}

export default function DealerCatalog({
  userId,
  dealerId,
  luxuryMode = false,
}: {
  userId: string | null;
  dealerId: string;
  luxuryMode?: boolean;
}) {
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
  const budgets = luxuryMode ? LUXURY_BUDGETS : STANDARD_BUDGETS;

  return (
    <div>
      <div className="flex gap-2 mb-3 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMaxBudget(null)}
          className={maxBudget === null ? "shrink-0 chip-active px-3 py-1.5" : "shrink-0 chip-inactive px-3 py-1.5"}
        >
          {t("dealerPage.budgetAll")}
        </button>
        {budgets.map((b) => (
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
              <div className="relative aspect-[4/3] bg-neutral-950">
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
              <div className="p-2.5 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 truncate">
                  {car.make}
                </p>
                <p className="text-sm font-semibold leading-5 line-clamp-2 min-h-10">
                  {car.model} {car.year ?? ""}
                </p>
                <p className="mt-1 text-sm font-bold text-neutral-900" dir="ltr">
                  {car.price ? formatPrice(car.price) : t("swipe.noPriceListed")}
                </p>
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
