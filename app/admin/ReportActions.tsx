"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ReportActions({
  messageId,
  senderId,
}: {
  messageId: string;
  senderId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function dismiss() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("messages").delete().eq("id", messageId);
    setLoading(false);
    router.refresh();
  }

  async function banSender() {
    if (!confirm("לחסום את השולח?")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("users").update({ is_banned: true }).eq("id", senderId);
    await supabase.from("messages").delete().eq("id", messageId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={dismiss}
        disabled={loading}
        className="text-xs rounded-md bg-neutral-100 text-neutral-700 px-3 py-1.5 disabled:opacity-50"
      >
        דחה דיווח
      </button>
      <button
        onClick={banSender}
        disabled={loading}
        className="text-xs rounded-md bg-red-700 text-white px-3 py-1.5 hover:bg-red-800 disabled:opacity-50"
      >
        חסום שולח
      </button>
    </div>
  );
}
