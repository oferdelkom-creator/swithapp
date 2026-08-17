"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { performSwipe } from "@/lib/swipeActions";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { CarRegion, SwipeDirection, VehicleType } from "@/lib/types";
import DraggableCard, { type DraggableCardHandle, type ExitDirection } from "./DraggableCard";
import QuickSignupModal from "@/components/QuickSignupModal";
import TradeDetailsModal from "@/components/TradeDetailsModal";
import VehicleTypeIcon from "@/components/VehicleTypeIcon";

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

  async function loadDeck() {
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

    if (mode === "sale") {
      const { data, error: rpcError } = await supabase.rpc("cars_for_sale", {
        my_id: effectiveUserId,
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
        my_id: effectiveUserId,
        p_category: vehicleType || null,
        p_make: filters.make || null,
        p_min_price: filters.minPrice ? Number(filters.minPrice) : null,
        p_max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
        p_min_year: filters.minYear ? Number(filters.minYear) : null,
        p_max_year: filters.maxYear ? Number(filters.maxYear) : null,
        p_max_distance_km: filters.radiusKm ? Number(filters.radiusKm) : null,
        p_include_dealers: includeDealers,
      });
      if (rpcError) setError(rpcError.message);
      setDeck((data as SwapCandidate[]) ?? []);
    }
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
      ) : current ? (
        <>
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
        </>
      ) : (
        <p className="text-neutral-500 text-sm">{t("swipe.noMoreCars")}</p>
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
