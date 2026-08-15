"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

interface BlockedEntry {
  blocked_id: string;
  blocked: { name: string } | null;
}

export default function BlockedUsersList({ blocked }: { blocked: BlockedEntry[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function unblock(blockedId: string) {
    setRemovingId(blockedId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
    }
    setRemovingId(null);
    router.refresh();
  }

  if (!blocked.length) return null;

  return (
    <div className="card p-6 space-y-3">
      <h2 className="font-medium">{t("profile.blockedUsersTitle")}</h2>
      <div className="space-y-2">
        {blocked.map((b) => (
          <div key={b.blocked_id} className="flex items-center justify-between text-sm">
            <span>{b.blocked?.name ?? t("admin.unknown")}</span>
            <button
              onClick={() => unblock(b.blocked_id)}
              disabled={removingId === b.blocked_id}
              className="text-xs text-brand-blue underline disabled:opacity-50"
            >
              {t("profile.unblock")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
