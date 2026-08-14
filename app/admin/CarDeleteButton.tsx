"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CarDeleteButton({ carId }: { carId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("להסיר את המודעה הזו?")) return;
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
      className="text-xs rounded-md bg-red-700 text-white px-3 py-1.5 hover:bg-red-800 disabled:opacity-50"
    >
      הסר
    </button>
  );
}
