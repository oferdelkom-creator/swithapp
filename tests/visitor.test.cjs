const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const visitorExports={};
const context={exports:visitorExports,process:{env:{}},Date,require:id=>id==='node:crypto'?require(id):id==='next/headers'?{cookies:async()=>({get:()=>null})}:id==='@supabase/supabase-js'?{createClient:()=>{throw Error('Unexpected DB use');}}:id==='./supabase/config'?{SUPABASE_URL:'https://example.test'}:(()=>{throw Error('Unknown import');})()};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/visitorSession.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
test('Visitor details require consent and valid contact data',()=>{
 assert.throws(()=>visitorExports.validateVisitorDetails({name:'לקוח',phone:'0501234567',consent:false}));
 assert.throws(()=>visitorExports.validateVisitorDetails({name:'x',phone:'abc',consent:true}));
 assert.throws(()=>visitorExports.validateVisitorDetails({name:'<script>',phone:'0501234567',consent:true}));
 const contact=visitorExports.validateVisitorDetails({name:' Test   Customer ',phone:'+1 (202) 555-0100',consent:true});
 assert.equal(contact.name,'Test Customer');assert.equal(contact.phone,'+12025550100');
 assert.equal(visitorExports.validateVisitorDetails({name:'לקוח בדיקה',phone:'050-1234567',consent:true}).phone,'+972501234567');
});
test('Visitor token is random; only its hash is stored',()=>{
 const first=visitorExports.newVisitorToken(),second=visitorExports.newVisitorToken();
 assert.match(first,/^[0-9a-f]{64}$/);assert.notEqual(first,second);
 assert.notEqual(visitorExports.tokenHash(first),first);assert.equal(visitorExports.tokenHash(first).length,64);
});
test('No visitor cookie means no privileged database request',async()=>{assert.equal(await visitorExports.getVisitorSession(),null);});
const pricingExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/dealerPricing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:pricingExports});
test('Both plans use 3% commission with VAT applied only to the fee',()=>{
 const amount=pricingExports.saleCommission(100000);
 assert.equal(amount.fee,3000);assert.equal(amount.vat,540);assert.equal(amount.total,3540);
 assert.equal(pricingExports.DEALER_TIERS[0].monthlyPrice,0);assert.equal(pricingExports.DEALER_TIERS[1].monthlyPrice,499);
 assert.throws(()=>pricingExports.saleCommission(-1));assert.throws(()=>pricingExports.saleCommission(Infinity));
});
