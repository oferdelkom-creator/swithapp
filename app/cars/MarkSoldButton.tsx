"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function MarkSoldButton({ carId }: { carId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function markSold() {
    if (!confirm(t("cars.confirmMarkSold"))) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("cars")
      .update({ sold_at: new Date().toISOString(), for_sale: false, for_swap: false })
      .eq("id", carId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={markSold}
      disabled={loading}
      className="text-xs text-brand-blue underline disabled:opacity-50"
    >
      {t("cars.markSold")}
    </button>
  );
}
