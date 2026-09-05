const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function analytics(overrides = {}) {
  const exports = {};
  const calls = [];
  const context = { exports, URLSearchParams, process: { env: {} },
    window: { location: { search: '?utm_source=google' }, gtag: (...args) => calls.push(args) },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    require: () => ({ track: () => {} }), ...overrides };
  const source = fs.readFileSync('lib/marketingAnalytics.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { ...exports, calls };
}

test('blocked storage does not interrupt attribution or completed signup', () => {
  const a = analytics({ sessionStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  assert.doesNotThrow(() => a.captureMarketingAttribution());
  assert.doesNotThrow(() => a.trackMarketingEvent('partner_signup_complete'));
  assert.equal(a.calls[0][1], 'partner_signup_complete');
});

test('one failed provider does not stop the remaining providers', () => {
  const a = analytics({ require: () => ({ track() { throw Error('provider down'); } }) });
  assert.doesNotThrow(() => a.trackMarketingEvent('partner_signup_complete'));
  assert.equal(a.calls.length, 1);
});

test('all analytics providers may fail without turning signup into an error', () => {
  const fail = () => { throw Error('blocked'); };
  const a = analytics({ window: { gtag: fail, fbq: fail }, require: () => ({ track: fail }) });
  assert.doesNotThrow(() => a.trackMarketingEvent('partner_signup_complete'));
});
