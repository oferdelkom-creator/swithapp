"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "sale" | "swap";

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
  const [mode, setMode] = useState<Mode>("sale");
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

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
      const { data, error: rpcError } = await supabase.rpc("cars_for_sale", { my_id: userId });
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
      setError("הדפדפן לא תומך במיקום");
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
      () => setError("לא ניתן היה לקבל מיקום")
    );
  }

  async function swipe(direction: "left" | "right") {
    const candidate = deck[index];
    if (!candidate) return;
    setBanner(null);
    const supabase = createClient();

    await supabase.from("swipes").insert({
      from_user_id: userId,
      to_user_id: candidate.user_id,
      car_id: candidate.car_id,
      direction,
    });

    if (direction === "right") {
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .or(
          `and(user_a_id.eq.${userId},user_b_id.eq.${candidate.user_id}),and(user_a_id.eq.${candidate.user_id},user_b_id.eq.${userId})`
        )
        .maybeSingle();
      if (match) setBanner("יש התאמה!");
    }

    setIndex((i) => i + 1);
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 text-sm">
        <button
          onClick={() => setMode("sale")}
          className={`px-3 py-1.5 rounded-md ${mode === "sale" ? "bg-brand-blue text-white" : "bg-neutral-100"}`}
        >
          למכירה
        </button>
        <button
          onClick={() => setMode("swap")}
          className={`px-3 py-1.5 rounded-md ${mode === "swap" ? "bg-brand-blue text-white" : "bg-neutral-100"}`}
        >
          להחלפה
        </button>
      </div>

      {banner && (
        <div className="mb-4 rounded-md bg-emerald-100 text-emerald-800 px-4 py-2 text-sm">
          {banner}{" "}
          <Link href="/matches" className="underline">
            למסך ההתאמות
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {mode === "swap" && (lat === null || lon === null) ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm text-neutral-600 mb-4">כדי לראות רכבים להחלפה לפי מרחק, יש לשתף מיקום.</p>
          <button
            onClick={requestLocation}
            className="rounded-md bg-brand-blue text-white px-4 py-2 text-sm"
          >
            שיתוף מיקום
          </button>
        </div>
      ) : loading ? (
        <p className="text-neutral-500 text-sm">טוען...</p>
      ) : deck[index] ? (
        <SwipeCard candidate={deck[index]} onSwipe={swipe} />
      ) : (
        <p className="text-neutral-500 text-sm">אין עוד רכבים להציג כרגע.</p>
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
  const photo = candidate.photo_urls?.[0];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={`${candidate.make} ${candidate.model}`} className="w-full h-56 object-cover" />
      ) : (
        <div className="w-full h-56 bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
          אין תמונה
        </div>
      )}
      <div className="p-5">
        <p className="font-medium text-lg">
          {candidate.make} {candidate.model} {candidate.year ?? ""}
        </p>
        {isSale(candidate) ? (
          <p className="text-sm text-neutral-500 mt-1">
            {candidate.seller_name} · {candidate.price ? `₪${candidate.price}` : "מחיר לא צוין"}
          </p>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">
            {candidate.name}
            {candidate.distance_km != null ? ` · ${candidate.distance_km.toFixed(0)} ק"מ` : ""}
            {candidate.want_make ? ` · מחפש ${candidate.want_make}` : ""}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onSwipe("left")}
            className="flex-1 rounded-md bg-neutral-100 text-neutral-700 px-4 py-2.5"
          >
            דילוג
          </button>
          <button
            onClick={() => onSwipe("right")}
            className="flex-1 rounded-md bg-brand-blue text-white px-4 py-2.5"
          >
            מעניין אותי
          </button>
        </div>
      </div>
    </div>
  );
}
