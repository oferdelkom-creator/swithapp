"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel, fuelTypeLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { Car } from "@/lib/types";

export default function CarDetail({ car, sellerName }: { car: Car; sellerName: string }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = car.photo_urls ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <button onClick={() => router.back()} className="text-sm text-brand-blue">
        {t("carDetail.back")}
      </button>

      <div className="relative w-full aspect-[4/5] rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-neutral-200">
        {photos.length > 0 ? (
          photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`${car.make} ${car.model}`}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: i === photoIndex ? 1 : 0 }}
            />
          ))
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
            {t("swipe.noPhoto")}
          </div>
        )}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setPhotoIndex((i) => Math.max(0, i - 1))}
              aria-label={t("carDetail.prevPhoto")}
              className="absolute inset-y-0 start-0 w-1/2"
            />
            <button
              onClick={() => setPhotoIndex((i) => Math.min(photos.length - 1, i + 1))}
              aria-label={t("carDetail.nextPhoto")}
              className="absolute inset-y-0 end-0 w-1/2"
            />
            <div className="absolute top-3 inset-x-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === photoIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {car.make} {car.model} {car.year ?? ""}
        </h1>
        <p className="text-neutral-500 mt-1">
          {sellerName}
          {car.price ? ` · ₪${car.price}` : ""}
        </p>
        <div className="flex gap-2 mt-3">
          {car.sold_at && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.sold")}</span>}
          {car.for_sale && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.forSale")}</span>}
          {car.for_swap && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.forSwap")}</span>}
        </div>
      </div>

      <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 grid grid-cols-2 gap-4 text-sm">
        <Field
          label={t("carForm.vehicleType")}
          value={t(VEHICLE_TYPES.find((vt) => vt.value === car.category)?.labelKey ?? "vehicleType.car")}
        />
        <Field label={t("carForm.mileage")} value={car.mileage != null ? String(car.mileage) : "-"} />
        <Field
          label={t("carForm.transmission")}
          value={car.transmission === "Manual" ? t("carForm.manual") : car.transmission === "Automatic" ? t("carForm.automatic") : "-"}
        />
        <Field label={t("carForm.color")} value={car.color ?? "-"} />
        <Field label={t("carForm.fuelType")} value={car.fuel_type ? fuelTypeLabel(car.fuel_type, locale) : "-"} />
        <Field label={t("carForm.region")} value={car.region ? regionLabel(car.region, locale) : "-"} />
        <Field label={t("carForm.hand")} value={car.hand != null ? String(car.hand) : "-"} />
      </div>

      {car.for_swap && (car.want_make || car.want_notes) && (
        <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 text-sm">
          <p className="font-medium mb-1">{t("carForm.wantMake")}</p>
          <p className="text-neutral-600">
            {[car.want_make, car.want_model].filter(Boolean).join(" ")}
            {car.want_notes ? ` · ${car.want_notes}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
