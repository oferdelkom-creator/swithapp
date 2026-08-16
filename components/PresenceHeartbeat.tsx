"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 30_000;

// Powers "online now" indicators elsewhere (car cards, car details, admin panel) -
// updates users.last_seen_at while this tab is open and in the foreground. Not a
// realtime presence channel, just a periodic timestamp write; "online" is computed
// as last_seen_at within the last couple of minutes wherever it's read.
export default function PresenceHeartbeat({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();

    function beat() {
      if (document.visibilityState !== "visible") return;
      supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    }

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [userId]);

  return null;
}
