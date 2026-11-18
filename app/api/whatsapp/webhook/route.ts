import { after } from "next/server";
import { normalizeWhatsAppAddress, verifyTwilioSignature } from "@/lib/whatsapp";
import { processWhatsAppMessage, readTwilioCreds, whatsappService } from "@/lib/whatsappProcessor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Immediate empty TwiML ack. We reply asynchronously via the REST API, because the model
// call can exceed Twilio's ~15s inbound-webhook timeout.
const ack = () =>
  new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function POST(request: Request) {
  const creds = readTwilioCreds();
  // Not configured yet: acknowledge so Twilio does not retry, but take no action.
  if (!creds) return ack();

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(await request.text())) params[k] = v;

  // The URL Twilio signed. Prefer an explicit env (reliable behind proxies/CDN); else reconstruct.
  const url =
    process.env.WHATSAPP_WEBHOOK_URL ??
    `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""}${new URL(request.url).pathname}`;
  if (!verifyTwilioSignature(creds.authToken, url, params, signature)) {
    return new Response("forbidden", { status: 403 });
  }

  const phone = normalizeWhatsAppAddress(params.From);
  const userMsg = (params.Body ?? "").trim().slice(0, 2000);
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !userMsg) return ack();

  // Confirm the message was addressed to the SwitchApp sender, not just that the signature is valid.
  if (normalizeWhatsAppAddress(params.To) !== normalizeWhatsAppAddress(creds.from)) return ack();

  const messageSid = params.MessageSid || params.SmsMessageSid || "";
  if (!messageSid) return ack();

  // Durably claim the inbound before acking: the row survives a crash, and a duplicate
  // MessageSid (Twilio retry) is a no-op, so each message is processed at most once here.
  const db = whatsappService();
  let leaseToken: string | null = null;
  try {
    const { data, error } = await db.rpc("claim_whatsapp_inbound", {
      p_sid: messageSid,
      p_phone: phone,
      p_to: normalizeWhatsAppAddress(params.To),
      p_body: userMsg,
    });
    // DB error claiming: return 5xx so Twilio retries rather than silently dropping it.
    if (error) return new Response("error", { status: 500 });
    leaseToken = typeof data === "string" ? data : null;
  } catch {
    return new Response("error", { status: 500 });
  }
  if (!leaseToken) return ack(); // duplicate (Twilio retry) or invalid input — safe to drop

  // Respond to Twilio immediately; do the slow model work + outbound reply after the response.
  const token = leaseToken;
  after(() => processWhatsAppMessage(db, creds, messageSid, phone, userMsg, token));
  return ack();
}
