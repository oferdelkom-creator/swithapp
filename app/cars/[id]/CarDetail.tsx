"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { performSwipe } from "@/lib/swipeActions";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel, fuelTypeLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { Car, SwipeDirection } from "@/lib/types";

export default function CarDetail({
  car,
  sellerName,
  sellerMemberSinceYear,
  sellerOnline,
  userId,
  isOwner,
  initiallyLiked,
  existingMatchId,
}: {
  car: Car;
  sellerName: string;
  sellerMemberSinceYear: number | null;
  sellerOnline: boolean;
  userId: string;
  isOwner: boolean;
  initiallyLiked: boolean;
  existingMatchId: string | null;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [liked, setLiked] = useState(initiallyLiked);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = car.photo_urls ?? [];

  function handleGalleryScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setPhotoIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }

  async function handleLike() {
    if (liked || swiping) return;
    setLiked(true);
    await runSwipe("right");
  }

  async function runSwipe(direction: SwipeDirection) {
    setSwiping(true);
    setError(null);
    const supabase = createClient();
    const result = await performSwipe(supabase, {
      userId,
      toUserId: car.user_id,
      carId: car.id,
      direction,
      icebreakerText: t("chat.icebreaker"),
    });
    setSwiping(false);

    if (result.capReached) {
      setError(t("swipe.swipeCapReached"));
      return;
    }
    if (result.match) {
      router.push(`/matches/${result.match.matchId}`);
      return;
    }
    router.back();
  }

  return (
    <div className="pb-24">
      <div className="relative w-full h-[75dvh] max-h-[700px] bg-neutral-200">
        {photos.length > 0 ? (
          <div
            ref={scrollRef}
            onScroll={handleGalleryScroll}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full"
          >
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${car.make} ${car.model}`}
                className="w-full h-full object-cover shrink-0 snap-center"
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
            {t("swipe.noPhoto")}
          </div>
        )}

        {photos.length > 1 && (
          <div className="absolute top-3 inset-x-0 flex justify-center gap-1.5 z-10">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === photoIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => router.back()}
          aria-label={t("carDetail.back")}
          className="absolute top-3 start-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur"
        >
          <XIcon />
        </button>

        {!isOwner && (
          <button
            onClick={handleLike}
            aria-label={t("carDetail.save")}
            disabled={swiping}
            className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur disabled:opacity-50"
          >
            <HeartIcon filled={liked} />
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {car.year ?? ""} {car.make} {car.model}
          </h1>
          <p className="text-neutral-500 mt-1">
            {[
              car.price ? `₪${car.price}` : t("swipe.noPriceListed"),
              car.region ? regionLabel(car.region, locale) : null,
              car.mileage != null ? `${car.mileage} ${t("swipe.km")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex gap-2 mt-3">
            {car.sold_at && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.sold")}</span>}
            {car.for_sale && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.forSale")}</span>}
            {car.for_swap && <span className="chip-inactive px-3 py-1 text-xs">{t("cars.forSwap")}</span>}
          </div>
        </div>

        <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 grid grid-cols-2 gap-4 text-sm">
          <Field label={t("carForm.year")} value={car.year != null ? String(car.year) : "-"} />
          <Field
            label={t("carForm.transmission")}
            value={
              car.transmission === "Manual"
                ? t("carForm.manual")
                : car.transmission === "Automatic"
                  ? t("carForm.automatic")
                  : "-"
            }
          />
          <Field label={t("carForm.fuelType")} value={car.fuel_type ? fuelTypeLabel(car.fuel_type, locale) : "-"} />
          <Field label={t("carForm.color")} value={car.color ?? "-"} />
          <Field label={t("carForm.region")} value={car.region ? regionLabel(car.region, locale) : "-"} />
          <Field label={t("carForm.hand")} value={car.hand != null ? String(car.hand) : "-"} />
          <Field
            label={t("carForm.vehicleType")}
            value={t(VEHICLE_TYPES.find((vt) => vt.value === car.category)?.labelKey ?? "vehicleType.car")}
          />
        </div>

        {car.description && (
          <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 text-sm">
            <p className="font-medium mb-1">{t("carForm.description")}</p>
            <p className="text-neutral-600 whitespace-pre-wrap">{car.description}</p>
          </div>
        )}

        {car.for_swap && (car.want_make || car.want_notes) && (
          <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 text-sm">
            <p className="font-medium mb-1">{t("carForm.wantMake")}</p>
            <p className="text-neutral-600">
              {[car.want_make, car.want_model].filter(Boolean).join(" ")}
              {car.want_notes ? ` · ${car.want_notes}` : ""}
            </p>
          </div>
        )}

        <div className="rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white p-5 flex items-center justify-between text-sm">
          <div>
            <p className="font-medium flex items-center gap-1.5">
              {sellerOnline && (
                <span title={t("presence.online")} className="inline-block w-2 h-2 rounded-full bg-green-500" />
              )}
              {t("carDetail.postedBy", { name: sellerName })}
            </p>
            {sellerMemberSinceYear && (
              <p className="text-neutral-500 text-xs mt-0.5">
                {t("carDetail.memberSince", { year: sellerMemberSinceYear })}
              </p>
            )}
          </div>
          {isOwner ? (
            <Link href={`/cars/${car.id}/edit`} className="btn-secondary text-xs">
              {t("carDetail.editListing")}
            </Link>
          ) : (
            existingMatchId && (
              <Link href={`/matches/${existingMatchId}`} className="btn-primary text-xs">
                {t("carDetail.chat")}
              </Link>
            )
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {!isOwner && !car.sold_at && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto flex justify-center items-center gap-6 py-3">
            <button
              onClick={() => runSwipe("left")}
              disabled={swiping}
              aria-label={t("swipe.skip")}
              className="w-[52px] h-[52px] rounded-full bg-gray-400 shadow-lg text-white text-lg flex items-center justify-center disabled:opacity-50"
            >
              ✕
            </button>
            <button
              onClick={() => runSwipe("maybe")}
              disabled={swiping}
              aria-label={t("swipe.maybe")}
              className="w-[52px] h-[52px] rounded-full bg-amber-500 shadow-lg text-white flex items-center justify-center disabled:opacity-50"
            >
              <TradeIcon />
            </button>
            <button
              onClick={() => runSwipe("right")}
              disabled={swiping}
              aria-label={t("swipe.interested")}
              className="w-[52px] h-[52px] rounded-full bg-green-500 shadow-lg text-white text-lg flex items-center justify-center disabled:opacity-50"
            >
              ♥
            </button>
          </div>
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

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#ff4458" : "none"} stroke={filled ? "#ff4458" : "currentColor"} strokeWidth="2">
      <path
        d="M12 20s-7.5-4.6-9.5-9.3C1.3 7.6 3 4.5 6.2 4.5c2 0 3.4 1.1 4.2 2.4L12 8.6l1.6-1.7c.8-1.3 2.2-2.4 4.2-2.4 3.2 0 4.9 3.1 3.7 6.2C19.5 15.4 12 20 12 20z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h11l-3-3" />
      <path d="M17 17H6l3 3" />
    </svg>
  );
}
