import { verifyTwilioInboundFreshness } from "./twilioInboundFreshness";
import type { WhatsAppProductionStore } from "./whatsappProductionStore";
import { getWhatsAppConfiguredStore } from "./whatsappProductionBootstrap";
import { plateConversation } from "./plateConversation";
import { runAssistant, type AssistantCar, type ChatMessage } from "@/lib/assistant";


export type TwilioCreds = { accountSid: string; authToken: string; from: string; apiKey: string };

// Dedicated scoped store is supplied by reviewed server bootstrap; no shared admin client.
export function whatsappService(): WhatsAppProductionStore { return getWhatsAppConfiguredStore(); }

// Isolated-test OpenAI stub (WHATSAPP_TEST_MODE=1 only): returns a canned flow without calling
// OpenAI. If the user's message looks like a dealer ("סוחר"/"מגרש"/dealer/lot), it drives the
// capture_dealer_lead tool so the dealer path is exercised too; otherwise a plain reply.
const testAssistantFetcher: typeof fetch = async (_url, init) => {
  let userText = "";
  let toolOutput: string | null = null;
  try {
    const raw = typeof init?.body === "string" ? init.body : "";
    const body = JSON.parse(raw) as { input?: Array<{ type?: string; role?: string; content?: unknown; output?: unknown }> };
    const input = Array.isArray(body.input) ? body.input : [];
    const outItem = input.find((i) => i?.type === "function_call_output");
    if (outItem && typeof outItem.output === "string") toolOutput = outItem.output;
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

  // First step for a dealer: drive the capture_dealer_lead tool.
  if (dealer && toolOutput === null) {
    return new Response(
      JSON.stringify({ output: [{ type: "function_call", name: "capture_dealer_lead", call_id: "test_call_1", arguments: JSON.stringify({ business_name: "מגרש בדיקה", city: "תל אביב" }) }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Final reply. If a tool ran, reflect its actual result instead of claiming success blindly.
  let text = "תשובת בדיקה מבודדת (WHATSAPP_TEST_MODE) — לא נעשתה קריאה ל-OpenAI.";
  if (toolOutput !== null) {
    let ok = false;
    try {
      ok = (JSON.parse(toolOutput) as { ok?: boolean }).ok === true;
    } catch {
      ok = false;
    }
    text = ok ? "רשמנו את הפרטים, הצוות יחזור אליך. (בדיקה מבודדת)" : "לא הצלחתי לרשום כרגע, אפשר לנסות שוב? (בדיקה מבודדת)";
  }
  return new Response(
    JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text }] }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

// Returns the Twilio + model credentials, or null if the channel is not fully configured.
export function readTwilioCreds(): TwilioCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+972..."
  const apiKey = process.env.OPENAI_API_KEY;
  if (process.env.WHATSAPP_PRODUCTION_ENABLED !== "1" || process.env.WHATSAPP_TEST_MODE || !accountSid || !authToken || !from || !apiKey) return null;
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
): Promise<{ outboundSid: string } | null> {
  // Production transport is inert unless explicitly enabled; synthetic mode is rejected.
  if (process.env.WHATSAPP_PRODUCTION_ENABLED !== "1" || process.env.WHATSAPP_TEST_MODE) return null;
  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      redirect: "error",
      headers,
      body: new URLSearchParams({ From: creds.from, To: `whatsapp:${toPhone}`, Body: body.slice(0, 1500) }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    if (res.redirected || res.headers.get("content-type")?.split(";")[0] !== "application/json") return null;
    const reader = res.body?.getReader(); if (!reader) return null;
    let timer: ReturnType<typeof setTimeout>; const timeout = new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("receipt_timeout")),10000);});
    const chunks: Uint8Array[]=[];let size=0;let receipt;
    try { while(true){const x=await Promise.race([reader.read(),timeout]);if(x.done)break;if((size+=x.value.length)>16384)throw Error();chunks.push(x.value);}receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))); }
    finally {clearTimeout(timer!);void reader.cancel().catch(()=>{});}
    if (receipt.account_sid !== creds.accountSid || receipt.from !== creds.from || receipt.to !== `whatsapp:${toPhone}` || receipt.body !== body.slice(0, 1500) || !/^SM[0-9a-f]{32}$/i.test(receipt.sid ?? "") || !["accepted", "queued", "sending", "sent", "delivered", "read"].includes(receipt.status)) return null;
    return { outboundSid: receipt.sid };
  } catch {
    return null;
  }
}

// Process one already-claimed inbound message: build a reply, deliver it, persist the
// conversation, and mark the inbound row processed. The row is claimed before this runs,
// so a crash is reconciled from durable state. Attempted sends are never automatically retried.
export async function processWhatsAppMessage(
  db: WhatsAppProductionStore,
  creds: TwilioCreds,
  messageSid: string,
  phone: string,
  userMsg: string,
  leaseToken: string,
): Promise<void> {
  if (process.env.WHATSAPP_TEST_MODE) return; // Production processor never contacts providers in isolated test mode.
  let outboundAttempt: string | null = null;
  const finish = async (ok: boolean, _error?: string) => {
    if (!ok || !outboundAttempt) return false;
    const saved = await db.appendHistoryOwned(messageSid, leaseToken, outboundAttempt);
    if (saved.error || saved.data !== true) return false; // HOLD on history uncertainty, including fallback replies.
    const { data, error } = await db.finishOwned(messageSid, leaseToken, outboundAttempt);
    if (error || data !== true) throw new Error("finish_unknown");
    return true;
  };
  const deliver = async (body: string, _idempotencyKey: string) => {
    // Verify the exact signed inbound Message resource immediately before a send attempt.
    // Unknown/stale metadata never becomes a free-form outbound message.
    try {
      await verifyTwilioInboundFreshness({ accountSid: creds.accountSid, authToken: creds.authToken,
        messageSid, from: `whatsapp:${phone}`, to: creds.from });
    } catch { await settleUnsent('dependency_error'); return false; }
    const exactBody = body.slice(0, 1500);
    const { data, error } = await db.beginAttemptOwned(messageSid, leaseToken, exactBody);
    if (error || typeof data !== "string") return false;
    outboundAttempt = data;
    const receipt = await sendWhatsApp(creds, phone, exactBody);
    if (!receipt) return false;
    const saved = await db.recordReceiptOwned(messageSid, leaseToken, data, receipt.outboundSid);
    return !saved.error && saved.data === true;
  };

  const settleUnsent = async (reason: 'rate_denied' | 'dependency_error') => {
    try { await db.settleUnsentOwned(messageSid, leaseToken, reason); } catch { /* recovery observes persisted state; no resend */ }
  };
  try {
    const limit = await db.rateLimitOwned(messageSid, leaseToken);
    if (limit.error || limit.data === null) { await settleUnsent('dependency_error'); return; }
    if (limit.data !== true) { await settleUnsent('rate_denied'); return; }
  } catch { await settleUnsent('dependency_error'); return; }

  let history: ChatMessage[] = [];
  let locale = "he";
  let intent: string | undefined;
  try {
    const { data, error } = await db.historyOwned(messageSid, leaseToken);
    if (error || data === null) { await settleUnsent("dependency_error"); return; }
    if (data) {
      history = Array.isArray(data.messages)
        ? data.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        : [];
      locale = ["he", "en", "ru", "ar"].includes(data.locale) ? data.locale : "he";
      intent = data.intent ?? undefined;
    }
  } catch {
    await settleUnsent("dependency_error"); return; // null/failure is not empty history
  }

  const messages: ChatMessage[] = [
    ...history.slice(-10).map((m): ChatMessage => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: "user" as const, content: userMsg },
  ].slice(-12);

  const plateAnswer = await plateConversation({ text: userMsg, locale,
    lookup: plate => db.lookupPlateOwned(messageSid, leaseToken, plate) });
  if (plateAnswer !== null) {
    const sent = await deliver(plateAnswer, `wa-plate-${messageSid}`);
    await finish(sent, 'plate_lookup');
    return;
  }
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
          const { data, error } = await db.captureLeadOwned(messageSid, leaseToken, String(args.business_name), typeof args.city === "string" ? args.city : null);
          if (error) throw error;
          if (data === true) {
            // Record a durable owned lead. No external team notification is sent here.
            capturedLead = { businessName: String(args.business_name), city: typeof args.city === "string" ? args.city : null };
            return { ok: true, note: "Lead recorded; our team will follow up. No account created, no payment taken." };
          }
          return { error: "Could not record the lead; ask the user to repeat the business or lot name." };
        }
        if (name !== "find_cars") throw new Error("not_allowed");
        const { data, error } = await db.findCarsOwned(messageSid, leaseToken, {
            make: args.make, model: args.model, min_price: args.min_price,
            max_price: args.max_price, min_year: args.min_year, electric_only: args.electric_only,
          });
        if (error || data === null) throw new Error("catalog_unavailable");
        return { cars: publicCars(data), currency: "ILS", note: "Current listings; seller confirmation is required." };
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

  if (!(await finish(true))) return;

  // Durable capture only. The cast handles assignment inside the assistant tool closure.
  // This path does not assert notification or delivered status.
  const lead = capturedLead as { businessName: string; city: string | null } | null;
  if (lead) {
    // Durable lead exists; no assertion that an external notification was sent.
    void lead;
  }

}

