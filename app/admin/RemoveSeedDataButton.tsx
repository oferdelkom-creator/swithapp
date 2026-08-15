"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function RemoveSeedDataButton() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm(t("admin.confirmRemoveSeedData"))) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_seed_data");
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={loading} className="btn-danger">
      {t("admin.removeSeedData")}
    </button>
  );
}
