type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type History = { messages: { role: 'user' | 'assistant'; content: string }[]; locale: string; intent: string | null };
type Mutation = 'claim_whatsapp_inbound' | 'begin_whatsapp_send' | 'mark_whatsapp_inbound_processed' | 'capture_whatsapp_dealer_lead' | 'append_whatsapp_message' | 'resolve_stuck_whatsapp_sends' | 'lease_stale_whatsapp_inbound';
// Compatibility interface only. Every mutation MUST be mapped to a guarded private RPC,
// never granted/executed under these legacy public names. Wiring remains closed until then.
export interface WhatsAppProductionStore {
  historyOwned(sid: string, token: string): Result<History>;
  settleUnsentOwned(sid: string, token: string, reason: 'rate_denied' | 'dependency_error'): Result<boolean>;
  rateLimitOwned(sid: string, token: string): Result<boolean>;
  lookupPlateWeb(plate: string): Result<Record<string, unknown>[]>;
  lookupPlateOwned(sid: string, token: string, plate: string): Result<Record<string, unknown>[]>;
  findCarsOwned(sid: string, token: string, filters: Record<string, unknown>): Result<Record<string, unknown>[]>;
  claimInbound(sid: string, account: string, from: string, to: string, body: string): Result<{ status: 'claimed'; token: string } | { status: 'duplicate' | 'queued' | 'denied' }>;
  captureLeadOwned(sid: string, token: string, business: string, city: string | null): Result<boolean>;
  beginAttemptOwned(sid: string, token: string, body: string): Result<string>;
  recordReceiptOwned(sid: string, token: string, attempt: string, outboundSid: string): Result<boolean>;
  appendHistoryOwned(sid: string, token: string, attempt: string): Result<boolean>;
  finishOwned(sid: string, token: string, attempt: string): Result<boolean>;
}
let installed: WhatsAppProductionStore | null = null;
// Server bootstrap only; NOT exposed through an HTTP handler or client import.
export function installWhatsAppProductionStore(store: WhatsAppProductionStore) {
  if (installed) throw Error('whatsapp_store_already_installed');
  installed = store;
}
export function getWhatsAppProductionStore(): WhatsAppProductionStore {
  if (process.env.WHATSAPP_PRODUCTION_ENABLED !== '1' || !installed) throw Error('whatsapp_scoped_store_not_configured');
  return installed;
}
