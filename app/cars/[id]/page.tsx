import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import CarDetail from "./CarDetail";

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/cars/${id}`);

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

  const isOwner = car.user_id === user.id;
  let alreadyLiked = false;
  let existingMatchId: string | null = null;

  if (!isOwner) {
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
      userId={user.id}
      isOwner={isOwner}
      initiallyLiked={alreadyLiked}
      existingMatchId={existingMatchId}
    />
  );
}
