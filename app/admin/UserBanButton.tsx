"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserBanButton({
  userId,
  isBanned,
}: {
  userId: string;
  isBanned: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("users").update({ is_banned: !isBanned }).eq("id", userId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs rounded-md px-3 py-1.5 disabled:opacity-50 ${
        isBanned ? "bg-neutral-100 text-neutral-700" : "bg-red-700 text-white hover:bg-red-800"
      }`}
    >
      {isBanned ? "בטל חסימה" : "חסום"}
    </button>
  );
}
