const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript');

const transpiled = ts.transpileModule(
  fs.readFileSync('lib/whatsapp.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const waModule = new Module('whatsapp');
waModule._compile(transpiled, 'lib/whatsapp.ts');
const wa = waModule.exports;

function sign(token, url, params) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
}

test('normalizeWhatsAppAddress strips the whatsapp: prefix and trims', () => {
  assert.equal(wa.normalizeWhatsAppAddress('whatsapp:+972501234567'), '+972501234567');
  assert.equal(wa.normalizeWhatsAppAddress('  whatsapp:+972501234567 '), '+972501234567');
  assert.equal(wa.normalizeWhatsAppAddress(null), '');
  assert.equal(wa.normalizeWhatsAppAddress(undefined), '');
});

test('verifyTwilioSignature accepts a correct signature and rejects tampering', () => {
  const token = 'test_auth_token';
  const url = 'https://www.switchapp.co.il/api/whatsapp/webhook';
  const params = { From: 'whatsapp:+972501234567', To: 'whatsapp:+972500000000', Body: 'שלום' };
  const good = sign(token, url, params);
  assert.equal(wa.verifyTwilioSignature(token, url, params, good), true);
  // tampered body must fail
  assert.equal(wa.verifyTwilioSignature(token, url, { ...params, Body: 'hacked' }, good), false);
  // wrong auth token must fail
  assert.equal(wa.verifyTwilioSignature('wrong_token', url, params, good), false);
  // wrong destination url must fail
  assert.equal(wa.verifyTwilioSignature(token, url + '/x', params, good), false);
  // empty signature / empty token must fail
  assert.equal(wa.verifyTwilioSignature(token, url, params, ''), false);
  assert.equal(wa.verifyTwilioSignature('', url, params, good), false);
});
