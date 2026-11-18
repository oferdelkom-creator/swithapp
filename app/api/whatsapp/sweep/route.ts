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
  const { data, error } = await db
    .from("whatsapp_inbound")
    .select("message_sid,phone_e164,body")
    .is("processed_at", null)
    .lt("attempts", 3)
    .order("received_at", { ascending: true })
    .limit(10);
  if (error) return new Response("error", { status: 503 });

  const rows = (data ?? []) as { message_sid: string; phone_e164: string; body: string }[];
  after(async () => {
    for (const row of rows) {
      await processWhatsAppMessage(db, creds, row.message_sid, row.phone_e164, row.body);
    }
  });
  return Response.json({ picked: rows.length });
}
