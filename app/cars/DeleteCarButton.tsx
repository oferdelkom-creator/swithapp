"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function DeleteCarButton({ carId }: { carId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm(t("cars.deleteConfirm"))) return;
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
      {t("cars.delete")}
    </button>
  );
}
