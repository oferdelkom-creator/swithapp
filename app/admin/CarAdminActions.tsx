"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CarAdminActions({
  carId,
  listingFeePaid,
  boostedUntil,
}: {
  carId: string;
  listingFeePaid: boolean;
  boostedUntil: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isBoosted = boostedUntil ? new Date(boostedUntil) > new Date() : false;

  async function run(update: Record<string, unknown>) {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("cars").update(update).eq("id", carId);
    setLoading(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("להסיר את המודעה הזו?")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("cars").delete().eq("id", carId);
    setLoading(false);
    router.refresh();
  }

  async function boost() {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    await run({ boosted_until: until.toISOString() });
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => run({ listing_fee_paid: !listingFeePaid })}
        disabled={loading}
        className="text-xs rounded-md bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
      >
        {listingFeePaid ? "עמלה שולמה ✓" : "סימון עמלה כשולמה"}
      </button>
      <button
        onClick={boost}
        disabled={loading}
        className="text-xs rounded-md bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
      >
        {isBoosted ? "מקודם ✓" : "קידום ל-7 ימים"}
      </button>
      <button
        onClick={remove}
        disabled={loading}
        className="text-xs rounded-md bg-red-700 text-white px-3 py-1.5 hover:bg-red-800 disabled:opacity-50"
      >
        הסר
      </button>
    </div>
  );
}
