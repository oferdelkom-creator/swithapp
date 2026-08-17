"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { performSwipe } from "@/lib/swipeActions";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES, getMakes, getModels } from "@/lib/vehicleData";
import type { CarRegion, SwipeDirection, VehicleType } from "@/lib/types";
import DraggableCard, { type DraggableCardHandle, type ExitDirection } from "./DraggableCard";
import QuickSignupModal from "@/components/QuickSignupModal";
import TradeDetailsModal from "@/components/TradeDetailsModal";
import VehicleTypeIcon from "@/components/VehicleTypeIcon";
import { parseSearchQuery } from "@/lib/searchParser";

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
  model: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  region: string;
  radiusKm: string;
  maxMileage: string;
  electricOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  make: "",
  model: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  region: "",
  radiusKm: "",
  maxMileage: "",
  electricOnly: false,
};

interface SaleCandidate {
  user_id: string;
  seller_name: string;
  seller_role: string;
  seller_online: boolean;
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
  seller_online: boolean;
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
  isPremium,
}: {
  userId: string | null;
  initialLat: number | null;
  initialLon: number | null;
  isPremium: boolean;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sale");
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<{ matchId: string; name: string } | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSummary, setSearchSummary] = useState<string[] | null>(null);
  // Mobile-only choice between the one-card swipe deck and a scrollable grid of
  // every matching car - desktop always gets the grid (no swipe gesture to offer
  // there in the first place), but a mobile visitor who wants to scan and find a
  // specific car quickly shouldn't be forced through the deck one card at a time.
  const [mobileView, setMobileView] = useState<"swipe" | "list">("swipe");
  const [vehicleType, setVehicleType] = useState<VehicleType | "">("");
  const [includeDealers, setIncludeDealers] = useState(false);
  const [lastAction, setLastAction] = useState<{ candidate: Candidate; direction: SwipeDirection } | null>(null);
  const [tradeCandidate, setTradeCandidate] = useState<Candidate | null>(null);
  const [authPrompt, setAuthPrompt] = useState<{ candidate: Candidate; showTradeDetails: boolean } | null>(null);
  const [swapAuthOpen, setSwapAuthOpen] = useState(false);
  // Browsing sale-mode cars needs no account (cars_for_sale() takes my_id: null) - a
  // signed-out visitor only needs to authenticate the moment they act on real intent
  // (Trade/Buy), via the inline QuickSignupModal below. Starts as the userId prop
  // (set server-side if already logged in) and gets promoted once that happens.
  const [effectiveUserId, setEffectiveUserId] = useState(userId);
  const cardRef = useRef<DraggableCardHandle>(null);

  // Shared by loadDeck() (fetches rows) and the live filter-count preview below
  // (fetches only a count) - one place building the RPC name/args pair so the two
  // can't drift apart on what a filter change actually queries. Accepts explicit
  // overrides so the search bar can fetch with brand-new filters immediately,
  // instead of reading stale `filters`/`vehicleType` state from before the setState
  // calls that requested them have actually re-rendered.
  function currentRpc(
    overrideFilters?: Filters,
    overrideVehicleType?: VehicleType | ""
  ): { name: "cars_for_sale" | "nearby_swap_cars"; args: Record<string, unknown> } {
    const f = overrideFilters ?? filters;
    const vt = overrideVehicleType ?? vehicleType;
    if (mode === "sale") {
      return {
        name: "cars_for_sale",
        args: {
          my_id: effectiveUserId,
          p_make: f.make || null,
          p_model: f.model || null,
          p_min_price: f.minPrice ? Number(f.minPrice) : null,
          p_max_price: f.maxPrice ? Number(f.maxPrice) : null,
          p_min_year: f.minYear ? Number(f.minYear) : null,
          p_max_year: f.maxYear ? Number(f.maxYear) : null,
          p_region: f.region || null,
          p_category: vt || null,
          p_max_mileage: f.maxMileage ? Number(f.maxMileage) : null,
          p_fuel_type: f.electricOnly ? "Electric" : null,
        },
      };
    }
    return {
      name: "nearby_swap_cars",
      args: {
        my_lat: lat,
        my_lon: lon,
        my_id: effectiveUserId,
        p_category: vt || null,
        p_make: f.make || null,
        p_model: f.model || null,
        p_min_price: f.minPrice ? Number(f.minPrice) : null,
        p_max_price: f.maxPrice ? Number(f.maxPrice) : null,
        p_min_year: f.minYear ? Number(f.minYear) : null,
        p_max_year: f.maxYear ? Number(f.maxYear) : null,
        p_max_distance_km: f.radiusKm ? Number(f.radiusKm) : null,
        p_include_dealers: includeDealers,
        p_max_mileage: f.maxMileage ? Number(f.maxMileage) : null,
      },
    };
  }

  async function loadDeck(overrideFilters?: Filters, overrideVehicleType?: VehicleType | "") {
    if (mode === "swap" && !effectiveUserId) {
      // Swap mode needs a real account to know the visitor's own role/location -
      // gated behind the sign-in prompt below rather than nearby_swap_cars() itself.
      setDeck([]);
      setLoading(false);
      return;
    }
    if (mode === "swap" && (lat === null || lon === null)) {
      setDeck([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { name, args } = currentRpc(overrideFilters, overrideVehicleType);
    const { data, error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) setError(rpcError.message);
    setDeck((data as Candidate[]) ?? []);
    setIndex(0);
    setPhotoIndex(0);
    setLastAction(null);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/mode-change is intentional
    loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lat, lon, vehicleType]);

  // Live "N cars" count on the Apply button while the filter panel is open, so
  // adjusting a field shows its effect before committing to it (mobile.de-style) -
  // a debounced count-only request (head: true, no rows transferred) against the
  // same RPC loadDeck() would call, not a second endpoint to keep in sync.
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  useEffect(() => {
    if (!showFilters) return;
    if (mode === "swap" && (!effectiveUserId || lat === null || lon === null)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale count when the panel can't query is intentional
      setPreviewCount(null);
      return;
    }
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { name, args } = currentRpc();
      const { count } = await supabase.rpc(name, args, { count: "exact", head: true });
      setPreviewCount(count ?? null);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFilters, filters, vehicleType, mode, effectiveUserId, lat, lon, includeDealers]);

  // Free-text search bar (mobile.de-inspired) - parseSearchQuery() is a local
  // keyword/regex parser, not a real LLM (no AI API key configured anywhere in this
  // project), so it only recognizes a fixed set of common phrasings. Replaces the
  // whole filter set rather than merging with whatever was there before, matching a
  // single search box's usual behavior - and calls loadDeck() with the new values
  // directly instead of relying on the just-requested state to have re-rendered yet.
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchSummary(null);
      setFilters(EMPTY_FILTERS);
      setVehicleType("");
      loadDeck(EMPTY_FILTERS, "");
      return;
    }
    const parsed = parseSearchQuery(searchQuery);
    const newFilters: Filters = {
      ...EMPTY_FILTERS,
      make: parsed.make ?? "",
      minPrice: parsed.minPrice != null ? String(parsed.minPrice) : "",
      maxPrice: parsed.maxPrice != null ? String(parsed.maxPrice) : "",
      minYear: parsed.minYear != null ? String(parsed.minYear) : "",
      maxYear: parsed.maxYear != null ? String(parsed.maxYear) : "",
      maxMileage: parsed.maxMileage != null ? String(parsed.maxMileage) : "",
      electricOnly: parsed.electricOnly,
      region: parsed.region ?? "",
    };
    const newVehicleType: VehicleType | "" = parsed.vehicleType ?? "";

    const summary: string[] = [];
    if (parsed.vehicleType) {
      const vt = VEHICLE_TYPES.find((v) => v.value === parsed.vehicleType);
      if (vt) summary.push(t(vt.labelKey));
    }
    if (parsed.make) summary.push(parsed.make);
    if (parsed.electricOnly) summary.push(t("swipe.electricOnly"));
    if (parsed.minYear != null || parsed.maxYear != null) {
      summary.push(
        parsed.minYear != null && parsed.maxYear != null
          ? `${parsed.minYear}-${parsed.maxYear}`
          : parsed.minYear != null
            ? `${parsed.minYear}+`
            : `≤${parsed.maxYear}`
      );
    }
    if (parsed.minPrice != null || parsed.maxPrice != null) {
      summary.push(
        parsed.minPrice != null && parsed.maxPrice != null
          ? `₪${parsed.minPrice}-₪${parsed.maxPrice}`
          : parsed.minPrice != null
            ? `₪${parsed.minPrice}+`
            : `≤₪${parsed.maxPrice}`
      );
    }
    if (parsed.maxMileage != null) summary.push(`≤${parsed.maxMileage}km`);
    if (parsed.region) summary.push(regionLabel(parsed.region, locale));

    setFilters(newFilters);
    setVehicleType(newVehicleType);
    setSearchSummary(summary);
    loadDeck(newFilters, newVehicleType);
  }

  function requestLocation() {
    if (!effectiveUserId) return;
    if (!navigator.geolocation) {
      setError(t("swipe.browserNoLocation"));
      return;
    }
    const uid = effectiveUserId;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const supabase = createClient();
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        await supabase.from("users").update({ lat: newLat, lon: newLon }).eq("id", uid);
        setLat(newLat);
        setLon(newLon);
      },
      () => setError(t("swipe.locationDenied"))
    );
  }

  async function swipe(candidate: Candidate, uid: string, direction: SwipeDirection, icebreakerText: string) {
    setError(null);
    const supabase = createClient();

    const result = await performSwipe(supabase, {
      userId: uid,
      toUserId: candidate.user_id,
      carId: candidate.car_id,
      direction,
      icebreakerText,
    });

    if (result.capReached) {
      setError(t("swipe.swipeCapReached"));
      setLastAction(null);
      setIndex((i) => i + 1);
      setPhotoIndex(0);
      return;
    }

    if (result.match) {
      // Undoing a swipe that just created a match would silently destroy a real
      // conversation - not offered as an option once that's happened.
      const name = isSale(candidate) ? candidate.seller_name : candidate.name;
      setMatchModal({ matchId: result.match.matchId, name });
      setLastAction(null);
    } else {
      setLastAction({ candidate, direction });
    }

    setIndex((i) => i + 1);
    setPhotoIndex(0);
  }

  // Undo is gated by the same "Premium users can delete their own swipes" RLS policy
  // already used for the rest of the app - deleting the swipe row lets it be re-shown
  // in the deck instead of just moving the index back, so it's a real undo (a re-load
  // would surface the same candidate again too), not a cosmetic one.
  async function undo() {
    if (!lastAction || !effectiveUserId) return;
    if (!isPremium) {
      setError(t("swipe.undoRequiresPremium"));
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("swipes")
      .delete()
      .eq("from_user_id", effectiveUserId)
      .eq("car_id", lastAction.candidate.car_id)
      .eq("direction", lastAction.direction);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setIndex((i) => Math.max(0, i - 1));
    setPhotoIndex(0);
    setLastAction(null);
  }

  function handleExit(direction: ExitDirection) {
    const candidate = deck[index];
    if (!candidate) return;
    const swipeDirection: SwipeDirection = direction === "up" ? "maybe" : direction;

    if (!effectiveUserId) {
      if (swipeDirection === "left") {
        // Passing costs nothing - just move on, no account needed to skip a listing.
        setIndex((i) => i + 1);
        setPhotoIndex(0);
        return;
      }
      setAuthPrompt({ candidate, showTradeDetails: swipeDirection === "maybe" });
      return;
    }

    if (swipeDirection === "maybe") {
      // Trade needs a description of the visitor's own car first - handled by the
      // modal below instead of swiping immediately.
      setTradeCandidate(candidate);
      return;
    }
    swipe(candidate, effectiveUserId, swipeDirection, t("chat.icebreaker"));
  }

  // Tap-zone routing for the photo gallery on the active card: left 40% = previous
  // photo, right 40% = next photo (or, once already on the last photo, tapping right
  // again triggers the same "Buy" action as the green button/right-swipe), center
  // 20% = open the car's details page.
  function handleTap(fraction: number) {
    const photos = current?.photo_urls ?? [];
    if (fraction < 0.4) {
      setPhotoIndex((i) => Math.max(0, i - 1));
    } else if (fraction > 0.6) {
      if (photoIndex < photos.length - 1) {
        setPhotoIndex((i) => i + 1);
      } else {
        cardRef.current?.triggerExit("right");
      }
    } else if (current) {
      router.push(`/cars/${current.car_id}`);
    }
  }

  const current = deck[index];
  const peek = deck[index + 1];

  return (
    <div>
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-3">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("swipe.searchPlaceholder")}
          className="field flex-1"
        />
        <button type="submit" className="btn-primary px-4" aria-label={t("swipe.search")}>
          <SearchIcon />
        </button>
      </form>
      {searchSummary && (
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
          {searchSummary.length ? (
            searchSummary.map((s, i) => (
              <span key={i} className="chip-active px-2.5 py-1">
                {s}
              </span>
            ))
          ) : (
            <span className="text-neutral-500">{t("swipe.searchNoMatch")}</span>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-3 text-sm">
        <button
          onClick={() => setMode("sale")}
          className={mode === "sale" ? "chip-active px-4 py-2 text-sm" : "chip-inactive px-4 py-2 text-sm"}
        >
          {t("swipe.forSale")}
        </button>
        <button
          onClick={() => setMode("swap")}
          className={mode === "swap" ? "chip-active px-4 py-2 text-sm" : "chip-inactive px-4 py-2 text-sm"}
        >
          {t("swipe.forSwap")}
        </button>
        <button onClick={() => setShowFilters((s) => !s)} className="btn-secondary">
          {t("swipe.filters")}
        </button>
        <div className="md:hidden flex gap-1 ms-auto">
          <button
            onClick={() => setMobileView("swipe")}
            aria-label={t("swipe.viewSwipe")}
            className={mobileView === "swipe" ? "chip-active px-3 py-2" : "chip-inactive px-3 py-2"}
          >
            <SwipeViewIcon />
          </button>
          <button
            onClick={() => setMobileView("list")}
            aria-label={t("swipe.viewList")}
            className={mobileView === "list" ? "chip-active px-3 py-2" : "chip-inactive px-3 py-2"}
          >
            <ListViewIcon />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 text-xs overflow-x-auto no-scrollbar -mx-4 px-4">
        <button
          onClick={() => setVehicleType("")}
          className={vehicleType === "" ? "shrink-0 chip-active px-3 py-1" : "shrink-0 chip-inactive px-3 py-1"}
        >
          {t("swipe.allVehicleTypes")}
        </button>
        {VEHICLE_TYPES.map((vt) => (
          <button
            key={vt.value}
            onClick={() => setVehicleType(vt.value)}
            title={t(vt.labelKey)}
            aria-label={t(vt.labelKey)}
            className={
              vehicleType === vt.value
                ? "shrink-0 inline-flex items-center justify-center chip-active px-3 py-1.5"
                : "shrink-0 inline-flex items-center justify-center chip-inactive px-3 py-1.5"
            }
          >
            <VehicleTypeIcon type={vt.value} />
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="card p-4 mb-3 grid grid-cols-2 gap-3 text-sm">
          <select
            value={filters.make}
            onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value, model: "" }))}
            className="field"
          >
            <option value="">{t("swipe.allMakes")}</option>
            {getMakes(vehicleType || "car").map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filters.model}
            onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
            disabled={!filters.make}
            className="field disabled:opacity-50"
          >
            <option value="">{t("swipe.allModels")}</option>
            {filters.make &&
              getModels(vehicleType || "car", filters.make).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
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
          <input
            type="number"
            placeholder={t("swipe.maxMileage")}
            value={filters.maxMileage}
            onChange={(e) => setFilters((f) => ({ ...f, maxMileage: e.target.value }))}
            className="field"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.electricOnly}
              onChange={(e) => setFilters((f) => ({ ...f, electricOnly: e.target.checked }))}
            />
            {t("swipe.electricOnly")}
          </label>
          {mode === "swap" && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeDealers}
                onChange={(e) => setIncludeDealers(e.target.checked)}
              />
              {t("swipe.includeDealers")}
            </label>
          )}
          <div className="col-span-2 flex gap-2">
            <button onClick={() => loadDeck()} className="btn-primary flex-1">
              {previewCount !== null ? t("swipe.applyFiltersCount", { count: previewCount }) : t("swipe.applyFilters")}
            </button>
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-secondary">
              {t("swipe.reset")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {mode === "swap" && !effectiveUserId ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-neutral-600 mb-4">{t("swipe.swapSignInPrompt")}</p>
          <button onClick={() => setSwapAuthOpen(true)} className="btn-primary">
            {t("swipe.swapSignInCta")}
          </button>
        </div>
      ) : mode === "swap" && (lat === null || lon === null) ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-neutral-600 mb-4">{t("swipe.shareLocationPrompt")}</p>
          <button onClick={requestLocation} className="btn-primary">
            {t("swipe.shareLocation")}
          </button>
        </div>
      ) : loading ? (
        <p className="text-neutral-500 text-sm">{t("swipe.loading")}</p>
      ) : deck.length === 0 ? (
        <p className="text-neutral-500 text-sm">{t("swipe.noMoreCars")}</p>
      ) : (
        <>
          {/* Swiping one card at a time is a mobile-gesture pattern - a mouse-and-
              keyboard desktop visitor gets the same result set as a browsable grid
              instead (below), so this whole block is hidden at md: and up. Also
              hidden on mobile when the visitor picked "list" over "swipe" above. */}
          <div className={mobileView === "list" ? "hidden" : "md:hidden"}>
            {current ? (
              <div className="relative h-[64dvh] max-h-[580px] min-h-[360px] [overscroll-behavior-x:contain]">
                {peek && (
                  <div key={peek.car_id} className="absolute inset-0 scale-[0.96] opacity-70 translate-y-2">
                    <CardVisual candidate={peek} photoIndex={0} />
                  </div>
                )}
                <DraggableCard key={current.car_id} ref={cardRef} active onExit={handleExit} onTap={handleTap}>
                  <CardVisual candidate={current} photoIndex={photoIndex} />
                </DraggableCard>

                <div className="absolute bottom-24 inset-x-0 z-20 flex justify-center items-end gap-4 pointer-events-none">
                  <div className="pointer-events-auto flex flex-col items-center gap-1">
                    <button
                      onClick={undo}
                      disabled={!lastAction}
                      aria-label={t("swipe.undo")}
                      title={isPremium ? t("swipe.undo") : t("swipe.undoRequiresPremium")}
                      className="w-[44px] h-[44px] rounded-full bg-white border border-neutral-200 shadow text-neutral-500 flex items-center justify-center hover:scale-105 hover:text-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-transform"
                    >
                      <UndoIcon />
                    </button>
                  </div>
                  <div className="pointer-events-auto flex flex-col items-center gap-1">
                    <button
                      onClick={() => cardRef.current?.triggerExit("left")}
                      aria-label={t("swipe.skip")}
                      className="w-[60px] h-[60px] rounded-full bg-gray-400 shadow-lg text-white text-xl flex items-center justify-center hover:scale-105 hover:bg-gray-500 transition-transform"
                    >
                      ✕
                    </button>
                    <span className="text-xs font-medium text-gray-400">{t("swipe.passLabel")}</span>
                  </div>
                  <div className="pointer-events-auto flex flex-col items-center gap-1">
                    <button
                      onClick={() => cardRef.current?.triggerExit("up")}
                      aria-label={t("swipe.maybe")}
                      className="w-[60px] h-[60px] rounded-full bg-amber-500 shadow-lg text-white flex items-center justify-center hover:scale-105 hover:bg-amber-600 transition-transform"
                    >
                      <TradeIcon />
                    </button>
                    <span className="text-xs font-medium text-amber-500">{t("swipe.tradeLabel")}</span>
                  </div>
                  <div className="pointer-events-auto flex flex-col items-center gap-1">
                    <button
                      onClick={() => cardRef.current?.triggerExit("right")}
                      aria-label={t("swipe.interested")}
                      className="w-[60px] h-[60px] rounded-full bg-green-500 shadow-lg text-white text-xl flex items-center justify-center hover:scale-105 hover:bg-green-600 transition-transform"
                    >
                      ♥
                    </button>
                    <span className="text-xs font-medium text-green-500">{t("swipe.buyLabel")}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">{t("swipe.noMoreCars")}</p>
            )}
          </div>

          {/* Always shown on desktop; shown on mobile too once "list" is picked
              above. Clicking a tile goes to /cars/[id] for the full details +
              Pass/Trade/Buy footer - no separate swipe-vs-grid state to keep in
              sync, both this and the deck above read straight from `deck`. */}
          <div
            className={`${mobileView === "list" ? "grid" : "hidden"} md:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4`}
          >
            {deck.map((c) => (
              <GridCard key={c.car_id} candidate={c} />
            ))}
          </div>
        </>
      )}

      {tradeCandidate && (
        <TradeDetailsModal
          candidateMake={tradeCandidate.make}
          candidateModel={tradeCandidate.model}
          onCancel={() => {
            setTradeCandidate(null);
            setIndex((i) => i + 1);
            setPhotoIndex(0);
          }}
          onSubmit={(details) => {
            const candidate = tradeCandidate;
            setTradeCandidate(null);
            swipe(candidate, effectiveUserId as string, "maybe", details);
          }}
        />
      )}

      {authPrompt && (
        <QuickSignupModal
          candidateMake={authPrompt.candidate.make}
          candidateModel={authPrompt.candidate.model}
          showTradeDetails={authPrompt.showTradeDetails}
          onCancel={() => {
            setAuthPrompt(null);
            setIndex((i) => i + 1);
            setPhotoIndex(0);
          }}
          onAuthenticated={(newUserId, icebreakerText) => {
            const candidate = authPrompt.candidate;
            const direction: SwipeDirection = authPrompt.showTradeDetails ? "maybe" : "right";
            setEffectiveUserId(newUserId);
            setAuthPrompt(null);
            swipe(candidate, newUserId, direction, icebreakerText);
          }}
        />
      )}

      {swapAuthOpen && (
        <QuickSignupModal
          candidateMake=""
          candidateModel=""
          showTradeDetails={false}
          onCancel={() => setSwapAuthOpen(false)}
          onAuthenticated={(newUserId) => {
            setEffectiveUserId(newUserId);
            setSwapAuthOpen(false);
          }}
        />
      )}

      {matchModal && (
        <MatchModal matchId={matchModal.matchId} name={matchModal.name} onClose={() => setMatchModal(null)} />
      )}
    </div>
  );
}

function GridCard({ candidate }: { candidate: Candidate }) {
  const { t } = useLocale();
  const photo = candidate.photo_urls?.[0];
  const sellerName = isSale(candidate) ? candidate.seller_name : candidate.name;
  const sellerOnline = candidate.seller_online;

  return (
    <Link href={`/cars/${candidate.car_id}`} className="card overflow-hidden">
      <div className="relative aspect-[4/3] bg-neutral-200">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${candidate.make} ${candidate.model}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
            {t("swipe.noPhoto")}
          </div>
        )}
        {candidate.category !== "car" && (
          <span className="absolute top-2 start-2 rounded-full bg-white/90 text-neutral-900 text-[10px] font-medium px-2 py-0.5">
            {t(VEHICLE_TYPES.find((vt) => vt.value === candidate.category)?.labelKey ?? "vehicleType.car")}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">
          {candidate.make} {candidate.model} {candidate.year ?? ""}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">
          {candidate.price ? `₪${candidate.price}` : t("swipe.noPriceListed")}
          {!isSale(candidate) && candidate.distance_km != null
            ? ` · ${t("swipe.distanceKm", { distance: candidate.distance_km.toFixed(0) })}`
            : ""}
        </p>
        <p className="text-xs text-neutral-400 mt-0.5 truncate flex items-center gap-1">
          {sellerOnline && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
          {sellerName}
        </p>
      </div>
    </Link>
  );
}

function CardVisual({ candidate, photoIndex }: { candidate: Candidate; photoIndex: number }) {
  const { t } = useLocale();
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const photos = candidate.photo_urls ?? [];
  const hasVisiblePhoto = photos.length > 0 && !broken[photoIndex];

  return (
    <div className="relative w-full h-full rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-neutral-200">
      {photos.map((url, i) =>
        broken[i] ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`${candidate.make} ${candidate.model}`}
            draggable={false}
            onError={() => setBroken((b) => ({ ...b, [i]: true }))}
            className="absolute inset-0 w-full h-full object-cover select-none transition-opacity duration-200"
            style={{ opacity: i === photoIndex ? 1 : 0 }}
          />
        )
      )}
      {!hasVisiblePhoto && (
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {candidate.category !== "car" && (
        <span className="absolute top-4 start-4 rounded-full bg-white/90 text-neutral-900 text-xs font-medium px-3 py-1">
          {t(VEHICLE_TYPES.find((vt) => vt.value === candidate.category)?.labelKey ?? "vehicleType.car")}
        </span>
      )}
      {/* Explicit, discoverable "see everything about this car" action, separate
          from the center tap-zone below - the whole point is letting someone who
          wants the full picture find it before they commit to Pass/Trade/Buy. */}
      <Link
        href={`/cars/${candidate.car_id}`}
        aria-label={t("swipe.viewDetails")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 end-4 z-10 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur"
      >
        <InfoIcon />
      </Link>
      <div className="absolute bottom-0 inset-x-0 p-5 text-white">
        <p className="font-bold text-2xl drop-shadow">
          {candidate.make} {candidate.model} {candidate.year ?? ""}
        </p>
        {isSale(candidate) ? (
          <p className="text-sm text-white/90 mt-1">
            {candidate.seller_online && (
              <span
                title={t("presence.online")}
                className="inline-block w-2 h-2 rounded-full bg-green-400 me-1.5 align-middle"
              />
            )}
            {candidate.seller_name} · {candidate.price ? `₪${candidate.price}` : t("swipe.noPriceListed")}
          </p>
        ) : (
          <p className="text-sm text-white/90 mt-1">
            {candidate.seller_online && (
              <span
                title={t("presence.online")}
                className="inline-block w-2 h-2 rounded-full bg-green-400 me-1.5 align-middle"
              />
            )}
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

function TradeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h11l-3-3" />
      <path d="M17 17H6l3 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function SwipeViewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="16" rx="2.5" transform="rotate(-8 9 11)" />
      <rect x="7" y="3" width="12" height="16" rx="2.5" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
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
