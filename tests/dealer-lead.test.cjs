const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const assistant = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('lib/assistant.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: assistant, AbortSignal, fetch, Map, Date }
);

test('validateDealerLead accepts a real lead and rejects bad input', () => {
  assert.deepEqual(assistant.validateDealerLead({ business_name: 'מגרש הצפון', city: 'חיפה' }), {
    business_name: 'מגרש הצפון',
    city: 'חיפה',
  });
  // city may be null
  assert.doesNotThrow(() => assistant.validateDealerLead({ business_name: 'Auto Max', city: null }));
  // too-short business name
  assert.throws(() => assistant.validateDealerLead({ business_name: 'A', city: null }));
  // wrong type
  assert.throws(() => assistant.validateDealerLead({ business_name: 123, city: null }));
  // extra keys are rejected (no injection of arbitrary fields)
  assert.throws(() => assistant.validateDealerLead({ business_name: 'Auto Max', city: null, role: 'admin' }));
  // oversized city
  assert.throws(() => assistant.validateDealerLead({ business_name: 'Auto Max', city: 'x'.repeat(81) }));
});
