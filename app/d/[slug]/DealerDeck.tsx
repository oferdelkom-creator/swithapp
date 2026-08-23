"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { performSwipe } from "@/lib/swipeActions";
import { useLocale } from "@/components/LocaleProvider";
import { VEHICLE_TYPES } from "@/lib/vehicleData";
import type { SwipeDirection, VehicleType } from "@/lib/types";
import DraggableCard, { type DraggableCardHandle, type ExitDirection } from "../../swipe/DraggableCard";
import QuickSignupModal from "@/components/QuickSignupModal";
import TradeDetailsModal from "@/components/TradeDetailsModal";

interface DealerCandidate {
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  category: VehicleType;
  price: number | null;
  photo_urls: string[];
  for_sale: boolean;
  for_swap: boolean;
  want_make: string | null;
}

export default function DealerDeck({
  userId,
  dealerId,
  luxuryMode = false,
}: {
  userId: string | null;
  dealerId: string;
  luxuryMode?: boolean;
}) {
  const { t } = useLocale();
  const [deck, setDeck] = useState<DealerCandidate[]>([]);
  const [index, setIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<{ matchId: string; name: string } | null>(null);
  const [tradeCandidate, setTradeCandidate] = useState<DealerCandidate | null>(null);
  const [authPrompt, setAuthPrompt] = useState<{ candidate: DealerCandidate; showTradeDetails: boolean } | null>(
    null
  );
  const [effectiveUserId, setEffectiveUserId] = useState(userId);
  const cardRef = useRef<DraggableCardHandle>(null);

  useEffect(() => {
    async function loadDeck() {
      setLoading(true);
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("dealer_inventory", {
        my_id: effectiveUserId,
        p_dealer_id: dealerId,
      });
      if (rpcError) setError(rpcError.message);
      setDeck((data as DealerCandidate[]) ?? []);
      setIndex(0);
      setPhotoIndex(0);
      setLoading(false);
    }
    loadDeck();
    // Deliberately not re-running when effectiveUserId changes mid-session (inline
    // sign-up via QuickSignupModal) - that would reset index/photoIndex and throw the
    // visitor back to the start of the deck right after they just acted on a card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  async function runSwipe(candidate: DealerCandidate, uid: string, direction: SwipeDirection, icebreakerText: string) {
    setError(null);
    const supabase = createClient();

    const result = await performSwipe(supabase, {
      userId: uid,
      toUserId: dealerId,
      carId: candidate.car_id,
      direction,
      icebreakerText,
    });

    if (result.capReached) {
      setError(t("swipe.swipeCapReached"));
      setIndex((i) => i + 1);
      setPhotoIndex(0);
      return;
    }

    if (result.match) {
      setMatchModal({ matchId: result.match.matchId, name: candidate.make + " " + candidate.model });
    }

    setIndex((i) => i + 1);
    setPhotoIndex(0);
  }

  function handleExit(direction: ExitDirection) {
    const candidate = deck[index];
    if (!candidate) return;

    if (!effectiveUserId) {
      if (direction === "left") {
        // Passing costs nothing - just move on, no account needed to skip a listing.
        setIndex((i) => i + 1);
        setPhotoIndex(0);
        return;
      }
      setAuthPrompt({ candidate, showTradeDetails: direction === "up" });
      return;
    }

    if (direction === "up") {
      // Trade needs a description of the visitor's own car first - handled by the modal
      // below instead of swiping immediately (index only advances once they submit or cancel).
      setTradeCandidate(candidate);
      return;
    }
    runSwipe(candidate, effectiveUserId, direction, t("chat.icebreaker"));
  }

  function handleTap(fraction: number) {
    const photos = current?.photo_urls ?? [];
    if (fraction < 0.4) {
      setPhotoIndex((i) => Math.max(0, i - 1));
    } else if (fraction > 0.6) {
      if (photoIndex < photos.length - 1) {
        setPhotoIndex((i) => i + 1);
      } else {
        handleExit("right");
      }
    }
  }

  const current = deck[index];
  const peek = deck[index + 1];

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-neutral-500 text-sm">{t("swipe.loading")}</p>
      ) : current ? (
        <div>
          <div className="relative h-[min(58dvh,540px)] min-h-[390px] [overscroll-behavior-x:contain]">
            {peek && (
              <div key={peek.car_id} className="absolute inset-0 scale-[0.96] opacity-70 translate-y-2">
                <CardVisual candidate={peek} photoIndex={0} luxuryMode={luxuryMode} />
              </div>
            )}
            <DraggableCard key={current.car_id} ref={cardRef} active onExit={handleExit} onTap={handleTap}>
              <CardVisual candidate={current} photoIndex={photoIndex} luxuryMode={luxuryMode} />
            </DraggableCard>
          </div>

          <div className="relative z-20 mt-4 flex justify-center items-start gap-6">
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

      {tradeCandidate && (
        <TradeDetailsModal
          candidateMake={tradeCandidate.make}
          candidateModel={tradeCandidate.model}
          candidatePrice={tradeCandidate.price}
          onCancel={() => {
            setTradeCandidate(null);
            setIndex((i) => i + 1);
            setPhotoIndex(0);
          }}
          onSubmit={(details) => {
            const candidate = tradeCandidate;
            setTradeCandidate(null);
            runSwipe(candidate, effectiveUserId as string, "maybe", details);
          }}
        />
      )}

      {authPrompt && (
        <QuickSignupModal
          candidateMake={authPrompt.candidate.make}
          candidateModel={authPrompt.candidate.model}
          candidatePrice={authPrompt.candidate.price}
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
            runSwipe(candidate, newUserId, direction, icebreakerText);
          }}
        />
      )}

      {matchModal && (
        <MatchModal matchId={matchModal.matchId} name={matchModal.name} onClose={() => setMatchModal(null)} />
      )}
    </div>
  );
}

function CardVisual({
  candidate,
  photoIndex,
  luxuryMode,
}: {
  candidate: DealerCandidate;
  photoIndex: number;
  luxuryMode: boolean;
}) {
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
      {/* Explicit, discoverable "see everything about this car" action - this deck
          previously had no way at all to reach the full details page before deciding. */}
      <Link
        href={`/cars/${candidate.car_id}`}
        aria-label={t("swipe.viewDetails")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 end-4 z-10 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur"
      >
        <InfoIcon />
      </Link>
      <div className="absolute bottom-0 inset-x-0 p-5 pb-6 text-white">
        {luxuryMode && <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-amber-300">EINAV LUXURY</p>}
        <p className="font-bold text-xl sm:text-2xl leading-tight drop-shadow line-clamp-2">
          {candidate.make} {candidate.model}
        </p>
        <p className="text-sm text-white/90 mt-1" dir="ltr">
          {candidate.year ?? ""}
          {candidate.price ? ` · ₪${candidate.price.toLocaleString("he-IL")}` : ` · ${t("swipe.noPriceListed")}`}
          {candidate.for_sale && ` · ${t("swipe.forSale")}`}
          {candidate.for_swap && ` · ${t("swipe.forSwap")}`}
          {candidate.want_make ? ` · ${t("swipe.lookingFor", { make: candidate.want_make })}` : ""}
        </p>
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
