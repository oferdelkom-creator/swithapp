const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in imports))throw Error('unmocked import '+n);return imports[n]},Buffer,URL,URLSearchParams,Response,Request,TextDecoder,AbortController,AbortSignal,setTimeout,clearTimeout,Date,Map,Set,fetch:()=>{throw Error('no real network')},...extra});return exports;}
const assistant=load('lib/assistant.ts'),api=load('lib/plateLookup.ts');
const plate='1234567',row={mispar_rechev:1234567,tozeret_nm:'Toyota',kinuy_mishari:'Corolla',shnat_yitzur:2020,tzeva_rechev:'White',sug_delek_nm:'Petrol',misgeret:'SECRET_VIN',owner_name:'SECRET_OWNER'};
const good=r=>Response.json({success:true,result:{records:r}});
test('explicit search only; normalized recognized formats; phones prices history and ambiguity rejected',()=>{
 for(const text of ['בדוק מספר רכב 1234567','בדקי לוחית 12-345-67','check plate 12 345 67','יש לי רכב למכירה, מס רשוי 1234567','מס רישוי 1234567','מספר רכב 1234567'])assert.equal(assistant.explicitPlateRequest(text),plate);
 for(const text of ['1234567','הטלפון שלי 0501234567','check price 1234567','check plate 0501234567','check plate 1234567 and 12345678','check plate abc1234567','בדוק מספר רישוי, הטלפון שלי 050-1234567','אל תבדוק מספר רכב 1234567',"do not check plate 1234567",'check plate 050-1234567','check plate 1234567abc','check template 1234567','check plate1234567','check plate 1234567-abc'])assert.equal(assistant.explicitPlateRequest(text),null,text);
});
test('fixed government target exact filter no redirects; public technical projection only',async()=>{
 const r=await api.lookupOfficialPlate(plate,async(u,o)=>{assert.equal(u.origin,'https://data.gov.il');assert.equal(u.pathname,'/api/3/action/datastore_search');assert.equal(u.searchParams.get('resource_id'),api.PLATE_RESOURCE);assert.equal(u.searchParams.get('filters'),JSON.stringify({mispar_rechev:plate}));assert.equal(o.redirect,'error');assert.equal(o.method,'GET');return good([row]);});
 assert.equal(r.status,'found');assert.doesNotMatch(JSON.stringify(r),/SECRET|misgeret|owner|1234567/);
});
test('empty source is not unavailable; error and malformed sources are not empty',async()=>{
 assert.equal((await api.lookupOfficialPlate(plate,async()=>good([]))).status,'not_found');
 for(const r of [Response.json({success:false}),good([row,row]),good([{...row,mispar_rechev:7654321}]),new Response('bad'),Response.json({success:true,result:{}})])assert.equal((await api.lookupOfficialPlate(plate,async()=>r)).status,'unavailable');
});
test('leading zero numeric mismatch not conflated; exact string preserved',async()=>{
 assert.equal((await api.lookupOfficialPlate('01234567',async()=>good([row]))).status,'unavailable');
 assert.equal((await api.lookupOfficialPlate('01234567',async()=>good([{...row,mispar_rechev:'01234567'}]))).status,'found');
});
test('invalid input never reaches source; response size and redirects fail closed',async()=>{
 await api.lookupOfficialPlate('https://evil',async()=>{assert.fail('called')});
 assert.equal((await api.lookupOfficialPlate(plate,async()=>new Response('x'.repeat(33000),{headers:{'content-type':'application/json'}}))).status,'unavailable');
 const r=good([row]);Object.defineProperty(r,'redirected',{value:true});assert.equal((await api.lookupOfficialPlate(plate,async()=>r)).status,'unavailable');
});
test('sources remain independent; only UUID SwitchApp link; no plate or private fields',()=>{
 const id='11111111-1111-4111-8111-111111111111';const found={status:'found',vehicle:{make:'Toyota',model:'Corolla',year:2020,color:'White',fuel:'Petrol'}};
 for(const lang of ['he','en','ru','ar']){const text=api.formatPlateLookup([{id,make:'Toyota',model:'Corolla',year:2020}],found,lang);assert.match(text,new RegExp('https://www.switchapp.co.il/cars/'+id));assert.doesNotMatch(text,/1234567|SECRET/);}
 assert.match(api.formatPlateLookup([],found,'en'),/No matching active listing/);assert.match(api.formatPlateLookup(null,found,'en'),/Listing lookup is currently unavailable/);
 assert.match(api.formatPlateLookup([{id,make:'Toyota'}],{status:'unavailable'},'en'),/Registry currently unavailable/);
 assert.doesNotMatch(api.formatPlateLookup([{id:'bad/id',make:'evil.example'}],{status:'found',vehicle:{...found.vehicle,model:'\u202ehttps://evil.example'}},'en'),/https:\/\/evil|evil.example|\u202e/);
});
for(const scenario of ['normal','internal_fail','registry_fail','both_fail'])test('processor deterministic single lookups '+scenario,async()=>{
 let internal=0,registry=0,model=0,sends=0;const calls=[],ok=data=>({data,error:null});
 const db={rateLimitOwned:async()=>ok(true),historyOwned:async()=>ok({messages:[],locale:'en',intent:null}),lookupPlateOwned:async(_s,_t,p)=>{internal++;assert.equal(p,plate);return scenario.includes('internal')||scenario==='both_fail'?{data:null,error:{message:'private'}}:ok([])},beginAttemptOwned:async()=>{calls.push('begin');return ok('11111111-1111-4111-8111-111111111111')},recordReceiptOwned:async()=>ok(true),appendHistoryOwned:async()=>{calls.push('append');return ok(true)},finishOwned:async()=>{calls.push('finish');return ok(true)},settleUnsentOwned:async()=>ok(true)};
 const creds={accountSid:'AC'+'a'.repeat(32),authToken:'b'.repeat(32),from:'whatsapp:+15550000002',apiKey:'synthetic'};
 const processor=load('lib/whatsappProcessor.ts',{'./twilioInboundFreshness':{verifyTwilioInboundFreshness:async()=>new Date().toISOString()},'./whatsappProductionBootstrap':{getWhatsAppConfiguredStore:()=>db},'./plateConversation':load('lib/plateConversation.ts',{'./assistant':assistant,'./plateLookup':{...api,lookupOfficialPlate:async p=>{registry++;assert.equal(p,plate);return {status:scenario==='registry_fail'||scenario==='both_fail'?'unavailable':'not_found'}}}}),'@/lib/assistant':{...assistant,runAssistant:async()=>{model++;throw Error('model must not be called')}}},{process:{env:{WHATSAPP_PRODUCTION_ENABLED:'1'}},fetch:async(_url,o)=>{sends++;const p=new URLSearchParams(o.body);assert.doesNotMatch(p.get('Body'),/1234567/);return Response.json({account_sid:creds.accountSid,from:creds.from,to:'whatsapp:+15550000001',body:p.get('Body'),sid:'SM'+'b'.repeat(32),status:'queued'})}});
 await processor.processWhatsAppMessage(db,creds,'SM'+'c'.repeat(32),'+15550000001','check plate 1234567','22222222-2222-4222-8222-222222222222');assert.deepEqual([internal,registry,model,sends],[1,1,0,1]);assert.deepEqual(calls,['begin','append','finish']);
});

test('test-mode processor is closed before source or persistence',async()=>{
 const boom=()=>{assert.fail('unexpected dependency')};
 const p=load('lib/whatsappProcessor.ts',{'./twilioInboundFreshness':{verifyTwilioInboundFreshness:boom},'./whatsappProductionBootstrap':{getWhatsAppConfiguredStore:boom},'./plateConversation':{plateConversation:boom},'@/lib/assistant':{...assistant,runAssistant:boom}},{process:{env:{WHATSAPP_TEST_MODE:'1'}}});
 await p.processWhatsAppMessage(new Proxy({},{get:()=>boom}),{},'x','x','check plate 1234567','x');
});
test('machine adapter exposes only exact guarded plate RPC and fails closed on invalid results',async()=>{
 const r=load('lib/whatsappMachineRpc.ts');const uid='11111111-1111-4111-8111-111111111111',now=Math.floor(Date.now()/1000);let calls=0,reply=[];
 const token='header.'+Buffer.from(JSON.stringify({sub:uid,iss:'https://hltpqflqngtrmprayyvd.supabase.co/auth/v1',aud:'authenticated',role:'switchapp_whatsapp_runtime',is_anonymous:false,iat:now,exp:now+300})).toString('base64url')+'.synthetic';
 const store=r.createWhatsAppMachineRpc(true,async()=>({subject:uid,publishableKey:'sb_publishable_synthetic',accessToken:token}),async(u,o)=>{calls++;assert.equal(u,'https://hltpqflqngtrmprayyvd.supabase.co/rest/v1/rpc/lookup_plate');assert.equal(o.headers['Content-Profile'],'whatsapp_api');const p=JSON.parse(o.body);assert.deepEqual(Object.keys(p).sort(),['p_plate','p_sid','p_token']);assert.equal(p.p_plate,plate);return Response.json(reply)});
 const sid='SM'+'a'.repeat(32);assert.equal((await store.lookupPlateOwned(sid,uid,plate)).data.length,0);
 for(const bad of [null,{},[{},{}]]){reply=bad;assert((await store.lookupPlateOwned(sid,uid,plate)).error);}
 const before=calls;assert((await store.lookupPlateOwned(sid,uid,'12-345-67')).error);assert.equal(calls,before);
});

test('bare valid number asks labeled resend; never trusts assistant history; test mode closed',async()=>{
 let calls=0; const conversation=load('lib/plateConversation.ts',{'./assistant':assistant,'./plateLookup':api});
 const deps={locale:'he',lookup:async()=>{calls++;return {data:[],error:null}},official:async()=>{calls++;return {status:'not_found'}}};
 assert.match(await conversation.plateConversation({...deps,text:'1234567'}),/מספר רישוי/);assert.equal(calls,0);
 assert.equal(await conversation.plateConversation({...deps,text:'מס רישוי 1234567',disabled:true}),null);assert.equal(calls,0);
 assert.match(await conversation.plateConversation({...deps,text:'יש לי רכב למכירה, מס רשוי 1234567'}),/משרד התחבורה/);assert.equal(calls,2);
});
