"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function LikeBackButton({ toUserId, carId }: { toUserId: string; carId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function likeBack() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("swipes")
      .insert({ from_user_id: user.id, to_user_id: toUserId, car_id: carId, direction: "right" });
    setDone(true);
    setLoading(false);
    router.refresh();
  }

  if (done) return <span className="text-xs text-emerald-700">{t("likes.sent")}</span>;

  return (
    <button
      onClick={likeBack}
      disabled={loading}
      className="text-xs rounded-full bg-brand-blue text-white px-3 py-1.5 disabled:opacity-50"
    >
      {t("likes.likeBack")}
    </button>
  );
}
