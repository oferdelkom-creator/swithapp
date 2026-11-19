// LOCAL REVIEW CANDIDATE. No identity provisioning, token persistence or fallback.
const ORIGIN = 'https://hltpqflqngtrmprayyvd.supabase.co';
const PROFILE = 'whatsapp_api';
const ROLE = 'switchapp_whatsapp_runtime';
type Context = { sid: string; token: string };
type Credential = { accessToken: string; subject: string; publishableKey: string };
type Provider = () => Promise<Credential>;
export type RpcResult = { data: unknown; error: { message: string } | null };
const operations = new Set(['settle_unsent', 'claim', 'history', 'rate_limit', 'find_cars', 'capture_lead', 'begin_attempt', 'record_receipt', 'append_history', 'finish']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createWhatsAppMachineRpc(enabled: boolean, credentials: Provider, fetcher: typeof fetch = fetch) {
  async function call(operation: string, args: Record<string, unknown>): Promise<RpcResult> {
    if (!enabled || !operations.has(operation)) return { data: null, error: { message: 'whatsapp_closed' } };
    try {
      const auth = await credentials();
      if (!uuid.test(auth.subject) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(auth.publishableKey)) throw Error();
      const pieces = auth.accessToken.split('.');
      if (pieces.length !== 3 || auth.accessToken.length > 8192) throw Error();
      const c = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      // Local checks are not signature verification; PostgREST must independently verify.
      if (c.sub !== auth.subject || c.iss !== ORIGIN + '/auth/v1' || c.aud !== 'authenticated' || c.role !== ROLE || c.is_anonymous !== false || c.client_id !== undefined || !Number.isSafeInteger(c.exp) || !Number.isSafeInteger(c.iat) || c.exp <= now || c.iat > now || c.exp <= c.iat || c.exp - c.iat > 300) throw Error();
      const response = await fetcher(ORIGIN + '/rest/v1/rpc/' + operation, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { apikey: auth.publishableKey, Authorization: 'Bearer ' + auth.accessToken, 'Content-Type': 'application/json', 'Accept-Profile': PROFILE, 'Content-Profile': PROFILE },
        body: JSON.stringify(args),
      });
      if (!response.ok || response.redirected) throw Error();
      if (response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error();
      const reader = response.body?.getReader(); if (!reader) throw Error();
      let timer: ReturnType<typeof setTimeout>; const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error()), 10000); });
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const next = await Promise.race([reader.read(), timeout]); if (next.done) break; if ((size += next.value.byteLength) > 65536) throw Error(); chunks.push(next.value); } return { data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))), error: null }; }
      finally { clearTimeout(timer!); void reader.cancel().catch(() => {}); }
    } catch { return { data: null, error: { message: 'whatsapp_rpc_unknown' } }; }
  }
  const owned = (context: Context) => {
    if (!/^SM[0-9a-f]{32}$/i.test(context.sid) || !uuid.test(context.token)) throw Error('invalid_context');
    const pinned = Object.freeze({ p_sid: context.sid, p_token: context.token });
    return Object.freeze({
      history: () => call('history', pinned),
      rateLimit: () => call('rate_limit', pinned),
      findCars: (filters: Record<string, unknown>) => call('find_cars', { ...pinned, p_filters: filters }),
    });
  };
  const args = (sid: string, token: string) => {
    if (!/^SM[0-9a-f]{32}$/i.test(sid) || !uuid.test(token)) throw Error('invalid_context');
    return { p_sid: sid, p_token: token };
  };
  const checked = async <T>(op: string, payload: Record<string, unknown>, shape: (data: unknown) => data is T) => {
    const r = await call(op, payload);
    if (r.error || r.data === null || !shape(r.data)) return { data: null, error: { message: 'whatsapp_rpc_unknown' } };
    return { data: r.data as T | null, error: null };
  };
  const bool = (x: unknown): x is boolean => typeof x === 'boolean';
  const id = (x: unknown): x is string => typeof x === 'string' && uuid.test(x);
  const store: import('./whatsappProductionStore').WhatsAppProductionStore = {
    claimInbound: (sid, account, from, to, body) => checked('claim', { p_sid: sid, p_account: account, p_from: from, p_to: to, p_body: body }, (x): x is { status: 'claimed'; token: string } | { status: 'duplicate' | 'queued' | 'denied' } => {
      if (!x || typeof x !== 'object') return false; const r = x as { status?: unknown; token?: unknown };
      return r.status === 'claimed' ? Object.keys(r).length === 2 && id(r.token) : Object.keys(r).length === 1 && ['duplicate','queued','denied'].includes(String(r.status));
    }),
    historyOwned: (sid, token) => checked('history', args(sid, token), (x): x is { messages: { role: 'user' | 'assistant'; content: string }[]; locale: string; intent: string | null } => {
      if (!x || typeof x !== 'object') return false;
      const h = x as { messages?: unknown; locale?: unknown; intent?: unknown };
      return Array.isArray(h.messages) && h.messages.length <= 12 && h.messages.every(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 2000) && typeof h.locale === 'string' && (h.intent === null || typeof h.intent === 'string');
    }),
    settleUnsentOwned: (sid, token, reason) => checked('settle_unsent', { ...args(sid, token), p_reason: reason }, bool),
    rateLimitOwned: (sid, token) => checked('rate_limit', args(sid, token), bool),
    findCarsOwned: (sid, token, filters) => checked('find_cars', { ...args(sid, token), p_filters: filters }, (x): x is Record<string, unknown>[] => Array.isArray(x) && x.length <= 8 && x.every(row => row && typeof row === 'object' && !Array.isArray(row))),
    captureLeadOwned: (sid, token, business, city) => checked('capture_lead', { ...args(sid, token), p_business: business, p_city: city }, bool),
    beginAttemptOwned: (sid, token, body) => checked('begin_attempt', { ...args(sid, token), p_body: body }, id),
    recordReceiptOwned: (sid, token, attempt, outboundSid) => checked('record_receipt', { ...args(sid, token), p_attempt: attempt, p_outbound_sid: outboundSid }, bool),
    appendHistoryOwned: (sid, token, attempt) => checked('append_history', { ...args(sid, token), p_attempt: attempt }, bool),
    finishOwned: (sid, token, attempt) => checked('finish', { ...args(sid, token), p_attempt: attempt }, bool),
  };
  return Object.freeze(store);
}
