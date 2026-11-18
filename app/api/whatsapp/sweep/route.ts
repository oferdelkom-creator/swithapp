import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { processWhatsAppMessage, readTwilioCreds, whatsappService } from "@/lib/whatsappProcessor";

export const runtime = "nodejs";
export const maxDuration = 60;

function secretOk(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Reprocess inbound WhatsApp messages that were claimed but never finished (crash,
// timeout, or a failed send). Idempotent per message via mark_whatsapp_inbound_processed.
// Call periodically from a scheduled job (Vercel Cron / Supabase cron) with the secret.
export async function GET(request: Request) {
  const expected = process.env.WHATSAPP_SWEEP_SECRET;
  const creds = readTwilioCreds();
  if (!expected || !creds) return new Response("not_configured", { status: 503 });

  const provided = request.headers.get("x-sweep-secret") ?? new URL(request.url).searchParams.get("secret") ?? "";
  if (!secretOk(provided, expected)) return new Response("forbidden", { status: 403 });

  const db = whatsappService();
  // Atomically lease stale pending rows (lease 5 min >> the 60s processing budget), so the
  // sweep never reprocesses a message the original webhook call still holds.
  const { data, error } = await db.rpc("lease_stale_whatsapp_inbound", {
    p_limit: 10,
    p_max_attempts: 3,
    p_lease_seconds: 300,
  });
  if (error) return new Response("error", { status: 503 });

  const rows = (data ?? []) as { message_sid: string; phone_e164: string; body: string }[];
  after(async () => {
    for (const row of rows) {
      await processWhatsAppMessage(db, creds, row.message_sid, row.phone_e164, row.body);
    }
  });
  return Response.json({ picked: rows.length });
}
