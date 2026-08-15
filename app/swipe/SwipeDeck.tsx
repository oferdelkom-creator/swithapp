"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel } from "@/lib/i18n/enumLabels";
import type { CarRegion } from "@/lib/types";

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

interface SaleFilters {
  make: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  region: string;
}

const EMPTY_FILTERS: SaleFilters = {
  make: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  region: "",
};

interface SaleCandidate {
  user_id: string;
  seller_name: string;
  seller_role: string;
  car_id: string;
  make: string;
  model: string;
  year: number | null;
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
  want_make: string | null;
  want_notes: string | null;
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
  const [banner, setBanner] = useState<string | null>(null);
  const [filters, setFilters] = useState<SaleFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

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
      });
      if (rpcError) setError(rpcError.message);
      setDeck((data as SaleCandidate[]) ?? []);
    } else {
      const { data, error: rpcError } = await supabase.rpc("nearby_swap_cars", {
        my_lat: lat,
        my_lon: lon,
        my_id: userId,
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
  }, [mode, lat, lon]);

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

  async function swipe(direction: "left" | "right") {
    const candidate = deck[index];
    if (!candidate) return;
    setBanner(null);
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
      if (match) setBanner(t("swipe.itsAMatch"));
    }

    setIndex((i) => i + 1);
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 text-sm">
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
        {mode === "sale" && (
          <button onClick={() => setShowFilters((s) => !s)} className="btn-secondary">
            {t("swipe.filters")}
          </button>
        )}
      </div>

      {mode === "sale" && showFilters && (
        <div className="card p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
          <input
            placeholder={t("swipe.make")}
            value={filters.make}
            onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
            className="field"
          />
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
            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS);
              }}
              className="btn-secondary"
            >
              {t("swipe.reset")}
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div className="mb-4 rounded-full bg-emerald-100 text-emerald-800 px-4 py-2 text-sm">
          {banner}{" "}
          <Link href="/matches" className="underline">
            {t("swipe.toMatches")}
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {mode === "swap" && (lat === null || lon === null) ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-neutral-600 mb-4">{t("swipe.shareLocationPrompt")}</p>
          <button onClick={requestLocation} className="btn-primary">
            {t("swipe.shareLocation")}
          </button>
        </div>
      ) : loading ? (
        <p className="text-neutral-500 text-sm">{t("swipe.loading")}</p>
      ) : deck[index] ? (
        <SwipeCard candidate={deck[index]} onSwipe={swipe} />
      ) : (
        <p className="text-neutral-500 text-sm">{t("swipe.noMoreCars")}</p>
      )}
    </div>
  );
}

function SwipeCard({
  candidate,
  onSwipe,
}: {
  candidate: Candidate;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const { t } = useLocale();
  const photo = candidate.photo_urls?.[0];

  return (
    <div className="card overflow-hidden">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={`${candidate.make} ${candidate.model}`} className="w-full h-56 object-cover" />
      ) : (
        <div className="w-full h-56 bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
          {t("swipe.noPhoto")}
        </div>
      )}
      <div className="p-5">
        <p className="font-medium text-lg">
          {candidate.make} {candidate.model} {candidate.year ?? ""}
        </p>
        {isSale(candidate) ? (
          <p className="text-sm text-neutral-500 mt-1">
            {candidate.seller_name} · {candidate.price ? `₪${candidate.price}` : t("swipe.noPriceListed")}
          </p>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">
            {candidate.name}
            {candidate.distance_km != null
              ? ` · ${t("swipe.distanceKm", { distance: candidate.distance_km.toFixed(0) })}`
              : ""}
            {candidate.want_make ? ` · ${t("swipe.lookingFor", { make: candidate.want_make })}` : ""}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onSwipe("left")}
            className="flex-1 rounded-full bg-neutral-100 text-neutral-700 px-4 py-2.5"
          >
            {t("swipe.skip")}
          </button>
          <button
            onClick={() => onSwipe("right")}
            className="flex-1 rounded-full bg-brand-blue text-white px-4 py-2.5"
          >
            {t("swipe.interested")}
          </button>
        </div>
      </div>
    </div>
  );
}
