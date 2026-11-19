const origin = 'https://api.twilio.com';
const account = /^AC[0-9a-fA-F]{32}$/;
const sid = /^SM[0-9a-fA-F]{32}$/;
const whatsapp = /^whatsapp:\+[1-9][0-9]{7,14}$/;
const stamp = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} (?:[+]0000|GMT)$/;
const deadlineMs = 3000;
const maxAgeMs = (24 * 60 * 60 - 90) * 1000;
const maxBytes = 16 * 1024;
export interface TwilioInboundIdentity {
  readonly accountSid: string;
  readonly authToken: string;
  readonly messageSid: string;
  readonly from: string;
  readonly to: string;
}
type Code = 'invalid_identity' | 'unavailable' | 'metadata_mismatch' | 'stale' | 'future';
export class TwilioFreshnessError extends Error {
  readonly code: Code;
  constructor(code: Code) { super(code); this.code = code; this.name = 'TwilioFreshnessError'; }
}
const fail = (code: Code): never => { throw new TwilioFreshnessError(code); };

/** Call only after the official Twilio signature check and matching configured account/To.
 * Produces only the verified UTC ISO provider timestamp. Neither body nor credentials are logged. */
export async function verifyTwilioInboundFreshness(
  input: TwilioInboundIdentity,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<string> {
  if (!account.test(input.accountSid) || !sid.test(input.messageSid) || !whatsapp.test(input.from) ||
      !whatsapp.test(input.to) || !/^[0-9a-fA-F]{32}$/.test(input.authToken)) fail('invalid_identity');
  // Capture primitives before the asynchronous transport; never derive origin from request.
  const { accountSid, authToken, messageSid, from, to } = input;
  const endpoint = origin + '/2010-04-01/Accounts/' + accountSid + '/Messages/' + messageSid + '.json';
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new TwilioFreshnessError('unavailable')); }, deadlineMs);
  });
  try {
    const response = await Promise.race([fetcher(endpoint, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64') },
    }), deadline]);
    if (response.status !== 200 || response.redirected || response.url !== endpoint ||
        response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('unavailable');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) fail('unavailable');
    reader = response.body?.getReader();
    if (!reader) return fail('unavailable');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) fail('unavailable');
      chunks.push(part.value);
    }
    const row: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    if (!row || Array.isArray(row) || typeof row !== 'object') return fail('metadata_mismatch');
    const r = row as Record<string, unknown>;
    if (r.account_sid !== accountSid || r.sid !== messageSid || r.direction !== 'inbound' ||
        r.from !== from || r.to !== to || typeof r.date_created !== 'string' || !stamp.test(r.date_created)) return fail('metadata_mismatch');
    const eventMs = Date.parse(r.date_created);
    const nowMs = now();
    if (!Number.isFinite(eventMs) || !Number.isSafeInteger(nowMs) ||
        new Date(eventMs).toUTCString() !== r.date_created.replace(/\+0000$/, 'GMT')) return fail('metadata_mismatch');
    if (eventMs > nowMs) return fail('future');
    if (nowMs - eventMs >= maxAgeMs) return fail('stale');
    return new Date(eventMs).toISOString();
  } catch (e) {
    if (e instanceof TwilioFreshnessError) throw e;
    return fail('unavailable'); // Do not propagate network errors or provider response details.
  } finally {
    clearTimeout(timer);
    if (reader) void reader.cancel().catch(() => {});
  }
}
