import { createHmac, timingSafeEqual } from "node:crypto";

// Strip Twilio's "whatsapp:" channel prefix from a From/To address and trim.
export function normalizeWhatsAppAddress(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.startsWith("whatsapp:") ? trimmed.slice("whatsapp:".length).trim() : trimmed;
}

// Validate Twilio's X-Twilio-Signature: HMAC-SHA1, base64, over the exact request URL
// concatenated with each POST param (sorted by key). Constant-time comparison.
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!authToken || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
