"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { CarRegion, SwipeDirection, VehicleType } from "@/lib/types";
import DraggableCard, { type DraggableCardHandle, type ExitDirection } from "./DraggableCard";

type Mode = "sale" | "swap";

const REGIONS: CarRegion[] = [
  "North",
  "Haifa",
  "Center",
  "Tel Aviv",
  "Jerusalem",
  "Shfela",
  "South",
  "Judea and Samaria",
];

interface Filters {
  make: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  region: string;
  radiusKm: string;
}

const EMPTY_FILTERS: Filters = {
  make: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  region: "",
  radiusKm: "",
};

interface SaleCandidate {
  user_id: string;
  seller_name: string;
  seller_role: string;
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  category: VehicleType;
  price: number | null;
  photo_urls: string[];
}

interface SwapCandidate {
  user_id: string;
  name: string;
  distance_km: number | null;
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  category: VehicleType;
  want_make: string | null;
  want_notes: string | null;
  price: number | null;
  photo_urls: string[];
}

type Candidate = SaleCandidate | SwapCandidate;

function isSale(c: Candidate): c is SaleCandidate {
  return "seller_name" in c;
}

export default function SwipeDeck({
  userId,
  initialLat,
  initialLon,
}: {
  userId: string;
  initialLat: number | null;
  initialLon: number | null;
}) {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState<Mode>("sale");
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<{ matchId: string; name: string } | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType | "">("");
  const cardRef = useRef<DraggableCardHandle>(null);

  async function loadDeck() {
    if (mode === "swap" && (lat === null || lon === null)) {
      setDeck([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (mode === "sale") {
      const { data, error: rpcError } = await supabase.rpc("cars_for_sale", {
        my_id: userId,
        p_make: filters.make || null,
        p_min_price: filters.minPrice ? Number(filters.minPrice) : null,
        p_max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
        p_min_year: filters.minYear ? Number(filters.minYear) : null,
        p_max_year: filters.maxYear ? Number(filters.maxYear) : null,
        p_region: filters.region || null,
        p_category: vehicleType || null,
      });
      if (rpcError) setError(rpcError.message);
      setDeck((data as SaleCandidate[]) ?? []);
    } else {
      const { data, error: rpcError } = await supabase.rpc("nearby_swap_cars", {
        my_lat: lat,
        my_lon: lon,
        my_id: userId,
        p_category: vehicleType || null,
        p_make: filters.make || null,
        p_min_price: filters.minPrice ? Number(filters.minPrice) : null,
        p_max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
        p_min_year: filters.minYear ? Number(filters.minYear) : null,
        p_max_year: filters.maxYear ? Number(filters.maxYear) : null,
        p_max_distance_km: filters.radiusKm ? Number(filters.radiusKm) : null,
      });
      if (rpcError) setError(rpcError.message);
      setDeck((data as SwapCandidate[]) ?? []);
    }
    setIndex(0);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/mode-change is intentional
    loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lat, lon, vehicleType]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setError(t("swipe.browserNoLocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const supabase = createClient();
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        await supabase.from("users").update({ lat: newLat, lon: newLon }).eq("id", userId);
        setLat(newLat);
        setLon(newLon);
      },
      () => setError(t("swipe.locationDenied"))
    );
  }

  async function swipe(direction: SwipeDirection) {
    const candidate = deck[index];
    if (!candidate) return;
    setError(null);
    const supabase = createClient();

    const { error: swipeError } = await supabase.from("swipes").insert({
      from_user_id: userId,
      to_user_id: candidate.user_id,
      car_id: candidate.car_id,
      direction,
    });

    if (swipeError) {
      // RLS doesn't distinguish *why* the insert was blocked, but the daily-cap check
      // is the only one a normal free user hits in practice (role/ownership checks
      // shouldn't fail for candidates the deck itself returned).
      setError(t("swipe.swipeCapReached"));
      setIndex((i) => i + 1);
      return;
    }

    if (direction === "right") {
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .or(
          `and(user_a_id.eq.${userId},user_b_id.eq.${candidate.user_id}),and(user_a_id.eq.${candidate.user_id},user_b_id.eq.${userId})`
        )
        .maybeSingle();
      if (match) {
        const name = isSale(candidate) ? candidate.seller_name : candidate.name;
        setMatchModal({ matchId: match.id, name });
        // Only the very first swiper to discover this match sends the icebreaker - a
        // match can only be created once (unique user pair), so an empty thread means
        // this is that first discovery.
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("match_id", match.id);
        if (!count) {
          await supabase
            .from("messages")
            .insert({ match_id: match.id, sender_id: userId, text: t("chat.icebreaker"), kind: "chat" });
        }
      }
    }

    setIndex((i) => i + 1);
  }

  function handleExit(direction: ExitDirection) {
    swipe(direction === "up" ? "maybe" : direction);
  }

  const current = deck[index];
  const peek = deck[index + 1];

  return (
    <div>
      <div className="flex gap-2 mb-3 text-sm">
        <button
          onClick={() => setMode("sale")}
          className={mode === "sale" ? "btn-primary" : "btn-secondary"}
        >
          {t("swipe.forSale")}
        </button>
        <button
          onClick={() => setMode("swap")}
          className={mode === "swap" ? "btn-primary" : "btn-secondary"}
        >
          {t("swipe.forSwap")}
        </button>
        <button onClick={() => setShowFilters((s) => !s)} className="btn-secondary">
          {t("swipe.filters")}
        </button>
      </div>

      <div className="flex gap-2 mb-3 text-xs overflow-x-auto no-scrollbar -mx-4 px-4">
        <button
          onClick={() => setVehicleType("")}
          className={
            vehicleType === ""
              ? "shrink-0 rounded-full bg-brand-blue-dark text-white px-3 py-1"
              : "shrink-0 rounded-full border border-neutral-300 text-neutral-600 px-3 py-1 hover:bg-neutral-50"
          }
        >
          {t("swipe.allVehicleTypes")}
        </button>
        {VEHICLE_TYPES.map((vt) => (
          <button
            key={vt.value}
            onClick={() => setVehicleType(vt.value)}
            className={
              vehicleType === vt.value
                ? "shrink-0 rounded-full bg-brand-blue-dark text-white px-3 py-1"
                : "shrink-0 rounded-full border border-neutral-300 text-neutral-600 px-3 py-1 hover:bg-neutral-50"
            }
          >
            {t(vt.labelKey)}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="card p-4 mb-3 grid grid-cols-2 gap-3 text-sm">
          <input
            placeholder={t("swipe.make")}
            value={filters.make}
            onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
            className="field"
          />
          {mode === "sale" ? (
            <select
              value={filters.region}
              onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}
              className="field"
            >
              <option value="">{t("swipe.allRegions")}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {regionLabel(r, locale)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              placeholder={t("swipe.radiusKm")}
              value={filters.radiusKm}
              onChange={(e) => setFilters((f) => ({ ...f, radiusKm: e.target.value }))}
              className="field"
            />
          )}
          <input
            type="number"
            placeholder={t("swipe.priceFrom")}
            value={filters.minPrice}
            onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
            className="field"
          />
          <input
            type="number"
            placeholder={t("swipe.priceTo")}
            value={filters.maxPrice}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
            className="field"
          />
          <input
            type="number"
            placeholder={t("swipe.yearFrom")}
            value={filters.minYear}
            onChange={(e) => setFilters((f) => ({ ...f, minYear: e.target.value }))}
            className="field"
          />
          <input
            type="number"
            placeholder={t("swipe.yearTo")}
            value={filters.maxYear}
            onChange={(e) => setFilters((f) => ({ ...f, maxYear: e.target.value }))}
            className="field"
          />
          <div className="col-span-2 flex gap-2">
            <button onClick={loadDeck} className="btn-primary flex-1">
              {t("swipe.applyFilters")}
            </button>
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-secondary">
              {t("swipe.reset")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {mode === "swap" && (lat === null || lon === null) ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-neutral-600 mb-4">{t("swipe.shareLocationPrompt")}</p>
          <button onClick={requestLocation} className="btn-primary">
            {t("swipe.shareLocation")}
          </button>
        </div>
      ) : loading ? (
        <p className="text-neutral-500 text-sm">{t("swipe.loading")}</p>
      ) : current ? (
        <>
          <div className="relative h-[64dvh] max-h-[580px] min-h-[360px]">
            {peek && (
              <div key={peek.car_id} className="absolute inset-0 scale-[0.96] opacity-70 translate-y-2">
                <CardVisual candidate={peek} />
              </div>
            )}
            <DraggableCard key={current.car_id} ref={cardRef} active onExit={handleExit}>
              <CardVisual candidate={current} />
            </DraggableCard>

            <div className="absolute bottom-24 inset-x-0 z-20 flex justify-center gap-4 pointer-events-none">
              <button
                onClick={() => cardRef.current?.triggerExit("left")}
                aria-label={t("swipe.skip")}
                className="pointer-events-auto w-14 h-14 rounded-full bg-red-500 shadow-lg text-white text-xl flex items-center justify-center hover:scale-105 hover:bg-red-600 transition-transform"
              >
                ✕
              </button>
              <button
                onClick={() => cardRef.current?.triggerExit("up")}
                aria-label={t("swipe.maybe")}
                className="pointer-events-auto w-12 h-12 self-center rounded-full bg-amber-400 shadow-lg text-white text-lg flex items-center justify-center hover:scale-105 hover:bg-amber-500 transition-transform"
              >
                ?
              </button>
              <button
                onClick={() => cardRef.current?.triggerExit("right")}
                aria-label={t("swipe.interested")}
                className="pointer-events-auto w-14 h-14 rounded-full bg-emerald-500 shadow-lg text-white text-xl flex items-center justify-center hover:scale-105 hover:bg-emerald-600 transition-transform"
              >
                ♥
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-neutral-500 text-sm">{t("swipe.noMoreCars")}</p>
      )}

      {matchModal && (
        <MatchModal matchId={matchModal.matchId} name={matchModal.name} onClose={() => setMatchModal(null)} />
      )}
    </div>
  );
}

function CardVisual({ candidate }: { candidate: Candidate }) {
  const { t } = useLocale();
  const [broken, setBroken] = useState(false);
  const photo = candidate.photo_urls?.[0];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl bg-neutral-200">
      {photo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={`${candidate.make} ${candidate.model}`}
          draggable={false}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover select-none"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
          {t("swipe.noPhoto")}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {candidate.category !== "car" && (
        <span className="absolute top-4 start-4 rounded-full bg-white/90 text-neutral-900 text-xs font-medium px-3 py-1">
          {t(VEHICLE_TYPES.find((vt) => vt.value === candidate.category)?.labelKey ?? "vehicleType.car")}
        </span>
      )}
      <div className="absolute bottom-0 inset-x-0 p-5 text-white">
        <p className="font-bold text-2xl drop-shadow">
          {candidate.make} {candidate.model} {candidate.year ?? ""}
        </p>
        {isSale(candidate) ? (
          <p className="text-sm text-white/90 mt-1">
            {candidate.seller_name} · {candidate.price ? `₪${candidate.price}` : t("swipe.noPriceListed")}
          </p>
        ) : (
          <p className="text-sm text-white/90 mt-1">
            {candidate.name} · {candidate.price ? `₪${candidate.price}` : t("swipe.noPriceListed")}
            {candidate.distance_km != null
              ? ` · ${t("swipe.distanceKm", { distance: candidate.distance_km.toFixed(0) })}`
              : ""}
            {candidate.want_make ? ` · ${t("swipe.lookingFor", { make: candidate.want_make })}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function MatchModal({ matchId, name, onClose }: { matchId: string; name: string; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="text-center text-white max-w-sm w-full">
        <p className="text-4xl font-extrabold tracking-tight mb-2">{t("swipe.itsAMatch")}</p>
        <p className="text-white/80 mb-8">{name}</p>
        <div className="flex flex-col gap-3">
          <Link href={`/matches/${matchId}`} className="btn-primary text-center py-3">
            {t("swipe.toMatches")}
          </Link>
          <button onClick={onClose} className="btn-secondary bg-white/10 text-white hover:bg-white/20 py-3">
            {t("swipe.keepSwiping")}
          </button>
        </div>
      </div>
    </div>
  );
}
