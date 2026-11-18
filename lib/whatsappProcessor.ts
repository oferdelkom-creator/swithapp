import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { runAssistant, type AssistantCar, type ChatMessage } from "@/lib/assistant";

export type TwilioCreds = { accountSid: string; authToken: string; from: string; apiKey: string };

// Service-role client for the WhatsApp channel (writes bypass RLS; reads are admin-only).
export function whatsappService(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("not_configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Returns the Twilio + model credentials, or null if the channel is not fully configured.
export function readTwilioCreds(): TwilioCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+972..."
  const apiKey = process.env.OPENAI_API_KEY;
  if (!accountSid || !authToken || !from || !apiKey) return null;
  return { accountSid, authToken, from, apiKey };
}

function publicCars(rows: Record<string, unknown>[]): AssistantCar[] {
  return rows.slice(0, 8).map((row) => ({
    id: String(row.car_id ?? row.id),
    make: String(row.make),
    model: String(row.model),
    year: row.year as number | null,
    price: row.price as number | null,
    mileage: row.mileage as number | null,
    fuel_type: row.fuel_type as string | null,
    region: row.region as string | null,
  }));
}

// Send an outbound WhatsApp message via Twilio REST and report whether Twilio accepted it.
// Returns true only on a 2xx response, so a failed send is never recorded as delivered.
export async function sendWhatsApp(creds: TwilioCreds, toPhone: string, body: string): Promise<boolean> {
  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
      body: new URLSearchParams({ From: creds.from, To: `whatsapp:${toPhone}`, Body: body.slice(0, 1500) }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Process one already-claimed inbound message: build a reply, deliver it, persist the
// conversation, and mark the inbound row processed. The row is claimed before this runs,
// so a crash here leaves it pending (processed_at IS NULL) for the sweep to retry.
export async function processWhatsAppMessage(
  db: SupabaseClient,
  creds: TwilioCreds,
  messageSid: string,
  phone: string,
  userMsg: string,
): Promise<void> {
  const finish = async (ok: boolean, error?: string) => {
    try {
      await db.rpc("mark_whatsapp_inbound_processed", { p_sid: messageSid, p_ok: ok, p_error: error ?? null });
    } catch {
      // best-effort; the sweep will see it as still pending and retry
    }
  };

  const limit = async (bucket: string, max: number) => {
    const { data, error } = await db.rpc("consume_visitor_request", { p_bucket: bucket, p_limit: max });
    return !error && data === true;
  };

  try {
    if (!(await limit(`wa:${phone}`, 20)) || !(await limit("wa_global", 300))) {
      const sent = await sendWhatsApp(creds, phone, "קיבלנו הרבה הודעות ברצף 🙏 נסה שוב בעוד כמה דקות.");
      await finish(sent, sent ? undefined : "throttle_send_failed");
      return;
    }
  } catch {
    await finish(false, "ratelimit_error");
    return;
  }

  let history: ChatMessage[] = [];
  let locale = "he";
  let intent: string | undefined;
  try {
    const { data } = await db
      .from("whatsapp_conversations")
      .select("messages,locale,intent")
      .eq("phone_e164", phone)
      .maybeSingle<{ messages: ChatMessage[]; locale: string; intent: string | null }>();
    if (data) {
      history = Array.isArray(data.messages)
        ? data.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        : [];
      locale = ["he", "en", "ru", "ar"].includes(data.locale) ? data.locale : "he";
      intent = data.intent ?? undefined;
    }
  } catch {
    // first contact for this phone
  }

  const messages: ChatMessage[] = [
    ...history.slice(-10).map((m): ChatMessage => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: "user" as const, content: userMsg },
  ].slice(-12);

  let answer: Awaited<ReturnType<typeof runAssistant>>;
  try {
    answer = await runAssistant({
      messages,
      business: false,
      intent,
      locale,
      apiKey: creds.apiKey,
      model: process.env.OPENAI_ASSISTANT_MODEL,
      channel: "whatsapp",
      execute: async (name, args) => {
        if (name !== "find_cars") throw new Error("not_allowed");
        const { data, error } = await db
          .rpc("cars_for_sale", {
            my_id: null,
            p_make: args.make,
            p_model: args.model,
            p_min_price: args.min_price,
            p_max_price: args.max_price,
            p_min_year: args.min_year,
            p_fuel_type: args.electric_only ? "Electric" : null,
          })
          .limit(8);
        if (error) throw error;
        return { cars: publicCars(data ?? []), currency: "ILS", note: "Current listings; seller confirmation is required." };
      },
    });
  } catch {
    const sent = await sendWhatsApp(creds, phone, "מצטער, יש תקלה רגעית אצלי 🙏 נסה שוב בעוד רגע.");
    await finish(sent, "model_error");
    return;
  }

  // Send first and verify delivery; only a delivered reply is recorded.
  const delivered = await sendWhatsApp(creds, phone, answer.text);
  if (!delivered) {
    await finish(false, "send_failed");
    return;
  }

  try {
    const { data: saved, error: saveError } = await db.rpc("append_whatsapp_message", {
      p_phone: phone,
      p_user: userMsg,
      p_assistant: answer.text,
      p_locale: locale,
      p_filters: answer.searchFilters,
      p_no_match: answer.noMatch,
    });
    if (saveError || saved === false) console.error("whatsapp_append_failed", { error: saveError?.message, saved });
  } catch (e) {
    console.error("whatsapp_append_threw", e instanceof Error ? e.message : e);
  }

  await finish(true);
}
