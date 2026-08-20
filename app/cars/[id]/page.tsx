import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import CarDetail from "./CarDetail";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: car } = await supabase
    .from("cars")
    .select("make, model, year, price, region, photo_urls, sold_at")
    .eq("id", id)
    .maybeSingle();
  if (!car || car.sold_at) return { title: SITE_NAME, robots: { index: false, follow: false } };

  const vehicleName = [car.make, car.model, car.year].filter(Boolean).join(" ");
  const details = [car.price ? `₪${Number(car.price).toLocaleString("en-US")}` : null, car.region].filter(Boolean).join(" · ");
  const url = `${SITE_URL}/cars/${id}`;
  const description = `${vehicleName} available on ${SITE_NAME}${details ? ` — ${details}` : ""}. View details, buy or propose a vehicle swap.`;
  return {
    title: `${vehicleName} | ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: { title: vehicleName, description, url, images: car.photo_urls?.slice(0, 1), type: "website" },
  };
}

// Open to signed-out visitors (2026-08-17) - the deck's new info button exists
// precisely so a visitor can read everything about a car before deciding whether to
// sign up and act on it, same reasoning as /swipe and /d/[slug]. cars/users SELECT
// RLS already allows anonymous reads; only the viewer-specific bits below (own-like,
// existing match) need a real user id, guarded accordingly.
export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: car } = await supabase.from("cars").select("*").eq("id", id).maybeSingle<Car>();
  if (!car) notFound();

  const { data: seller } = await supabase
    .from("users")
    .select("name, created_at, last_seen_at")
    .eq("id", car.user_id)
    .maybeSingle<{ name: string; created_at: string; last_seen_at: string | null }>();

  const twoMinutesAgo = new Date();
  twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
  const sellerOnline = !!seller?.last_seen_at && new Date(seller.last_seen_at) > twoMinutesAgo;

  const isOwner = user ? car.user_id === user.id : false;
  let alreadyLiked = false;
  let existingMatchId: string | null = null;

  if (user && !isOwner) {
    const [{ data: swipeRow }, { data: matchRow }] = await Promise.all([
      supabase
        .from("swipes")
        .select("id")
        .eq("from_user_id", user.id)
        .eq("car_id", car.id)
        .eq("direction", "right")
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id")
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${car.user_id}),and(user_a_id.eq.${car.user_id},user_b_id.eq.${user.id})`
        )
        .maybeSingle(),
    ]);
    alreadyLiked = !!swipeRow;
    existingMatchId = matchRow?.id ?? null;
  }

  return (
    <CarDetail
      car={car}
      sellerName={seller?.name ?? ""}
      sellerMemberSinceYear={seller?.created_at ? new Date(seller.created_at).getFullYear() : null}
      sellerOnline={sellerOnline}
      userId={user?.id ?? null}
      isOwner={isOwner}
      initiallyLiked={alreadyLiked}
      existingMatchId={existingMatchId}
    />
  );
}
