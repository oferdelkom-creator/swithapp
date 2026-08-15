"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "./LocaleProvider";

// Foreground-only: shows a browser Notification while this tab is open, via a
// Supabase Realtime subscription on matches the caller is part of (RLS already
// restricts delivery to rows where the caller is user_a/user_b - see
// "Users can view their own matches"). There's no service worker or push server, so
// this can't wake a closed tab or notify when the phone is locked - see README.
export default function MatchNotifier({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { t } = useLocale();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const supabase = createClient();
    const notify = () =>
      new Notification(t("notifications.newMatchTitle"), { body: t("notifications.newMatchBody") });

    const channel = supabase
      .channel(`match-notify-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user_a_id=eq.${userId}` },
        notify
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user_b_id=eq.${userId}` },
        notify
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, t]);

  return null;
}
