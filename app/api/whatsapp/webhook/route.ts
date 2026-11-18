import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { runAssistant, type AssistantCar, type ChatMessage } from "@/lib/assistant";
import { normalizeWhatsAppAddress, verifyTwilioSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

function service() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("not_configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Immediate empty TwiML ack. We reply asynchronously via the REST API (see below),
// because the model call can exceed Twilio's ~15s inbound-webhook timeout.
const ack = () =>
  new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });

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

// Send an outbound WhatsApp message via Twilio REST (free-form allowed inside the 24h window).
async function sendWhatsApp(sid: string, token: string, from: string, toPhone: string, body: string) {
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
    body: new URLSearchParams({ From: from, To: `whatsapp:${toPhone}`, Body: body.slice(0, 1500) }).toString(),
    signal: AbortSignal.timeout(10000),
  });
}

async function handle(phone: string, userMsg: string, authToken: string, apiKey: string, accountSid: string, from: string) {
  const db = service();
  const limit = async (bucket: string, max: number) => {
    const { data, error } = await db.rpc("consume_visitor_request", { p_bucket: bucket, p_limit: max });
    return !error && data === true;
  };
  try {
    if (!(await limit(`wa:${phone}`, 20)) || !(await limit("wa_global", 300))) {
      await sendWhatsApp(accountSid, authToken, from, phone, "קיבלנו הרבה הודעות ברצף 🙏 נסה שוב בעוד כמה דקות.");
      return;
    }
  } catch {
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
      apiKey,
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
    await sendWhatsApp(accountSid, authToken, from, phone, "מצטער, יש תקלה רגעית אצלי 🙏 נסה שוב בעוד רגע.");
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

  await sendWhatsApp(accountSid, authToken, from, phone, answer.text);
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+972..."
  // Not configured yet: acknowledge so Twilio does not retry, but take no action.
  if (!authToken || !apiKey || !accountSid || !from) return ack();

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(await request.text())) params[k] = v;

  // The URL Twilio signed. Prefer an explicit env (reliable behind proxies/CDN); else reconstruct.
  const url =
    process.env.WHATSAPP_WEBHOOK_URL ??
    `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""}${new URL(request.url).pathname}`;
  if (!verifyTwilioSignature(authToken, url, params, signature)) {
    return new Response("forbidden", { status: 403 });
  }

  const phone = normalizeWhatsAppAddress(params.From);
  const userMsg = (params.Body ?? "").trim().slice(0, 2000);
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !userMsg) return ack();

  // Confirm the message was addressed to the SwitchApp sender, not just that the signature is valid.
  if (normalizeWhatsAppAddress(params.To) !== normalizeWhatsAppAddress(from)) return ack();

  // Respond to Twilio immediately; do the slow model work + outbound reply after the response.
  after(() => handle(phone, userMsg, authToken, apiKey, accountSid, from));
  return ack();
}
