import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { runAssistant, type AssistantCar, type ChatMessage } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

function service() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("not_configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const XML_ESCAPE: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const reply = (text: string) => xml(`<Message>${text.replace(/[<>&'"]/g, (c) => XML_ESCAPE[c])}</Message>`);
const ack = () => xml("");

// Twilio signs: the exact request URL + each POST param (sorted by key, concatenated),
// HMAC-SHA1 with the account auth token, base64-encoded.
function validSignature(authToken: string, url: string, params: Record<string, string>, signature: string) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
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

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;
  // Not configured yet: acknowledge so Twilio does not retry, but take no action.
  if (!authToken || !apiKey) return ack();

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(await request.text())) params[k] = v;

  // The URL Twilio signed. Prefer an explicit env (reliable behind proxies/CDN); else reconstruct.
  const url =
    process.env.WHATSAPP_WEBHOOK_URL ??
    `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""}${new URL(request.url).pathname}`;
  if (!signature || !validSignature(authToken, url, params, signature)) {
    return new Response("forbidden", { status: 403 });
  }

  const phone = (params.From ?? "").replace(/^whatsapp:/, "").trim();
  const userMsg = (params.Body ?? "").trim().slice(0, 2000);
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !userMsg) return ack();

  const db = service();
  const limit = async (bucket: string, max: number) => {
    const { data, error } = await db.rpc("consume_visitor_request", { p_bucket: bucket, p_limit: max });
    return !error && data === true;
  };

  try {
    if (!(await limit(`wa:${phone}`, 20)) || !(await limit("wa_global", 300))) {
      return reply("קיבלנו הרבה הודעות ברצף 🙏 נסה שוב בעוד כמה דקות.");
    }
  } catch {
    return ack();
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
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: "user", content: userMsg },
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
    return reply("מצטער, יש תקלה רגעית אצלי 🙏 נסה שוב בעוד רגע.");
  }

  try {
    await db.rpc("append_whatsapp_message", {
      p_phone: phone,
      p_user: userMsg,
      p_assistant: answer.text,
      p_locale: locale,
      p_filters: answer.searchFilters,
      p_no_match: answer.noMatch,
    });
  } catch {
    // reply even if persistence failed
  }

  return reply(answer.text.slice(0, 1500));
}
