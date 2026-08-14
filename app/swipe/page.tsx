import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SwipeDeck from "./SwipeDeck";

export default async function SwipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/swipe");

  const { data: me } = await supabase
    .from("users")
    .select("lat, lon")
    .eq("id", user.id)
    .maybeSingle<{ lat: number | null; lon: number | null }>();

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">סווייפ</h1>
      <SwipeDeck userId={user.id} initialLat={me?.lat ?? null} initialLon={me?.lon ?? null} />
    </div>
  );
}
