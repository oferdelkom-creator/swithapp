import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runAssistant, type AssistantCar, type ChatMessage } from "@/lib/assistant";
import { sendDealerLeadAlert } from "@/lib/email/dealerLeadAlert";

export type TwilioCreds = { accountSid: string; authToken: string; from: string; apiKey: string };

// The production Supabase project ref. Used only to refuse the live DB while in test mode.
const PRODUCTION_SUPABASE_REF = "hltpqflqngtrmprayyvd";

// Service-role client for the WhatsApp channel (writes bypass RLS; reads are admin-only).
// No production fallback: unlike lib/supabase/config, the WhatsApp channel must NEVER silently
// write to the live DB when the URL env is missing (e.g. a misconfigured preview). The URL must
// be set explicitly, so a misconfiguration fails loudly instead of hitting production. And in
// isolated test mode it hard-refuses the production database.
export function whatsappService(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("not_configured");
  if (process.env.WHATSAPP_TEST_MODE === "1") {
    // Positive allowlist: the target DB must be the explicitly named test branch (not just
    // "not the known production ref"), so an inherited/wrong URL cannot slip through.
    const expected = process.env.WHATSAPP_TEST_EXPECTED_REF;
    if (!expected || !url.includes(expected)) throw new Error("test_mode_url_not_allowlisted");
    if (url.includes(PRODUCTION_SUPABASE_REF)) throw new Error("test_mode_cannot_use_production_db");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Isolated-test OpenAI stub (WHATSAPP_TEST_MODE=1 only): returns a canned flow without calling
// OpenAI. If the user's message looks like a dealer ("סוחר"/"מגרש"/dealer/lot), it drives the
// capture_dealer_lead tool so the dealer path is exercised too; otherwise a plain reply.
const testAssistantFetcher: typeof fetch = async (_url, init) => {
  let userText = "";
  let hasToolOutput = false;
  try {
    const raw = typeof init?.body === "string" ? init.body : "";
    const body = JSON.parse(raw) as { input?: Array<{ type?: string; role?: string; content?: unknown }> };
    const input = Array.isArray(body.input) ? body.input : [];
    hasToolOutput = input.some((i) => i?.type === "function_call_output");
    for (let i = input.length - 1; i >= 0; i--) {
      if (input[i]?.role === "user" && typeof input[i]?.content === "string") {
        userText = input[i].content as string;
        break;
      }
    }
  } catch {
    // fall through to a plain reply
  }
  const dealer = /סוחר|מגרש|dealer|lot/i.test(userText);
  const output =
    dealer && !hasToolOutput
      ? [{ type: "function_call", name: "capture_dealer_lead", call_id: "test_call_1", arguments: JSON.stringify({ business_name: "מגרש בדיקה", city: "תל אביב" }) }]
      : [{ type: "message", content: [{ type: "output_text", text: dealer ? "רשמנו את הפרטים, הצוות יחזור אליך. (בדיקה מבודדת)" : "תשובת בדיקה מבודדת (WHATSAPP_TEST_MODE) — לא נעשתה קריאה ל-OpenAI." }] }];
  return new Response(JSON.stringify({ output }), { status: 200, headers: { "Content-Type": "application/json" } });
};

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

// Send an outbound WhatsApp message via Twilio REST and report whether Twilio ACCEPTED it
// (2xx). Acceptance means Twilio queued the message, not that the customer received it —
// true delivery needs Twilio status callbacks (a follow-up). The idempotencyKey is sent as a
// best-effort hint only; the Messages API is not documented to dedupe on it, so duplicate
// safety comes from never resending a message a send was already attempted for (send_attempted_at),
// not from this header.
export async function sendWhatsApp(
  creds: TwilioCreds,
  toPhone: string,
  body: string,
  idempotencyKey?: string,
): Promise<boolean> {
  // Isolated test mode: never call the real Twilio API; simulate acceptance so the flow and
  // DB separation can be verified without sending real messages.
  if (process.env.WHATSAPP_TEST_MODE === "1") {
    console.log("[wa-test-mode] simulated WhatsApp send", { to: toPhone, chars: body.length });
    return true;
  }
  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      headers,
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
  leaseToken: string,
): Promise<void> {
  const finish = async (ok: boolean, error?: string) => {
    try {
      await db.rpc("mark_whatsapp_inbound_processed", { p_sid: messageSid, p_token: leaseToken, p_ok: ok, p_error: error ?? null });
    } catch {
      // best-effort; the sweep will see it as still pending and retry
    }
  };

  // Record that a send was attempted BEFORE calling Twilio, then send. The sweep only
  // retries rows where no send was ever attempted, so a crash after this point is never
  // auto-resent — we do not rely on Twilio deduping the outbound by idempotency key.
  const deliver = async (body: string, idempotencyKey: string) => {
    // Atomically claim the send under valid ownership (sets send_attempted_at only if still
    // null). If we cannot record the attempt — a DB error, or another processor already
    // claimed it — do not send, so a message is never sent without the duplicate guard.
    try {
      const { data, error } = await db.rpc("begin_whatsapp_send", { p_sid: messageSid, p_token: leaseToken });
      if (error || data !== true) return false;
    } catch {
      return false;
    }
    return sendWhatsApp(creds, phone, body, idempotencyKey);
  };

  const limit = async (bucket: string, max: number) => {
    const { data, error } = await db.rpc("consume_visitor_request", { p_bucket: bucket, p_limit: max });
    return !error && data === true;
  };

  try {
    if (!(await limit(`wa:${phone}`, 20)) || !(await limit("wa_global", 300))) {
      const sent = await deliver("קיבלנו הרבה הודעות ברצף 🙏 נסה שוב בעוד כמה דקות.", `wa-throttle-${messageSid}`);
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

  let capturedLead: { businessName: string; city: string | null } | null = null;
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
      fetcher: process.env.WHATSAPP_TEST_MODE === "1" ? testAssistantFetcher : undefined,
      execute: async (name, args) => {
        if (name === "capture_dealer_lead") {
          const { data, error } = await db.rpc("capture_whatsapp_dealer_lead", {
            p_phone: phone,
            p_business: args.business_name,
            p_city: args.city ?? null,
          });
          if (error) throw error;
          if (data === true) {
            // Record the lead now (idempotent upsert). The team alert is deferred until after
            // the ownership-gated reply is delivered, so a worker that lost its lease never emails.
            capturedLead = { businessName: String(args.business_name), city: typeof args.city === "string" ? args.city : null };
            return { ok: true, note: "Lead recorded; our team will follow up. No account created, no payment taken." };
          }
          return { error: "Could not record the lead; ask the user to repeat the business or lot name." };
        }
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
    const sent = await deliver("מצטער, יש תקלה רגעית אצלי 🙏 נסה שוב בעוד רגע.", `wa-error-${messageSid}`);
    await finish(sent, "model_error");
    return;
  }

  // Record the attempt, then send and check Twilio accepted it (2xx = accepted by the
  // provider, not confirmed delivered). A crash after the attempt is never auto-resent.
  const accepted = await deliver(answer.text, `wa-reply-${messageSid}`);
  if (!accepted) {
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

  // Ownership-gated human handoff: we only reach here after a successful, owned send, so the
  // team is alerted exactly once by the worker that actually delivered the reply. (The cast
  // is needed because the value is assigned inside the runAssistant tool closure above.)
  const lead = capturedLead as { businessName: string; city: string | null } | null;
  if (lead) {
    await sendDealerLeadAlert({ phone, businessName: lead.businessName, city: lead.city }).catch(() => {});
  }

  await finish(true);
}
