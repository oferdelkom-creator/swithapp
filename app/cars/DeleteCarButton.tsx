"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCarButton({ carId }: { carId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("למחוק את המודעה הזו?")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("cars").delete().eq("id", carId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      className="text-xs text-red-700 underline disabled:opacity-50"
    >
      מחיקה
    </button>
  );
}
