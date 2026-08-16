import { createClient } from "@/lib/supabase/client";
import type { SwipeDirection } from "@/lib/types";

export interface SwipeResult {
  capReached: boolean;
  match: { matchId: string } | null;
}

// Shared by the swipe deck and the car details page - both let a user swipe on a
// candidate, and a right-swipe needs the exact same match-detection + icebreaker
// logic in either place, so this is one implementation instead of two that could
// drift apart.
export async function performSwipe(
  supabase: ReturnType<typeof createClient>,
  params: { userId: string; toUserId: string; carId: string; direction: SwipeDirection; icebreakerText: string }
): Promise<SwipeResult> {
  const { userId, toUserId, carId, direction, icebreakerText } = params;

  const { error: swipeError } = await supabase.from("swipes").insert({
    from_user_id: userId,
    to_user_id: toUserId,
    car_id: carId,
    direction,
  });

  // RLS doesn't distinguish *why* the insert was blocked, but the daily-cap check is
  // the only one a normal free user hits in practice (role/ownership checks shouldn't
  // fail for a candidate the caller was legitimately shown).
  if (swipeError) {
    return { capReached: true, match: null };
  }

  if (direction !== "right") {
    return { capReached: false, match: null };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .or(`and(user_a_id.eq.${userId},user_b_id.eq.${toUserId}),and(user_a_id.eq.${toUserId},user_b_id.eq.${userId})`)
    .maybeSingle();

  if (!match) return { capReached: false, match: null };

  // Only the very first swiper to discover this match sends the icebreaker - a match
  // can only be created once (unique user pair), so an empty thread means this is
  // that first discovery.
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("match_id", match.id);
  if (!count) {
    await supabase
      .from("messages")
      .insert({ match_id: match.id, sender_id: userId, text: icebreakerText, kind: "chat" });
  }

  return { capReached: false, match: { matchId: match.id } };
}
