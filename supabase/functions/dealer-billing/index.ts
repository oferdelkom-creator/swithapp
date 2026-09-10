import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
const site = "https://www.switchapp.co.il";
const origins = new Set([site,"https://switchapp.co.il","https://switchautoai.com","https://www.switchautoai.com"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (x:unknown,n=50) => typeof x==='string'?x.trim().slice(0,n):'';
function checked<T>(r:{data:T,error:unknown}):T { if(r.error) throw new Error('database_operation_failed');return r.data; }
async function cardcom(path:string, body:Record<string,unknown>, config:Record<string,unknown>) {
 const res=await fetch('https://secure.cardcom.solutions/api/v11/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({TerminalNumber:config.terminal,ApiName:config.api_name,...body}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw new Error('provider_unavailable');
 return await res.json();
}
function documentFor(a:any,o:any) {
 return {DocumentTypeToCreate:'TaxInvoiceAndReceipt',Name:a.legal_name,TaxId:a.tax_id,Email:a.email,IsSendByEmail:true,IsVatFree:false,ExternalId:o.id,Comments:'SwitchApp — המחירים כוללים מע״מ',Products:[{Description:o.kind==='setup'?'SwitchApp — הקמת פלטפורמה ואולם תצוגה':`SwitchApp — אחזקה לחודש ${o.period}; שיא ${o.peak} רכבים`,Quantity:1,UnitCost:o.amount_agorot/100,TotalLineCost:o.amount_agorot/100,IsVatFree:false}]};
}
async function verifySetup(o:any,config:any) {
 if(o.status==='paid')return 'paid';
 const result=await cardcom('LowProfile/GetLpResult',{LowProfileId:o.low_profile_id},config);
 const tx=result.TranzactionInfo ?? result.TransactionInfo;
 if(Number(result.ResponseCode)!==0 || !tx || Number(tx.ResponseCode)!==0)return 'pending';
 const transaction=String(result.TranzactionId ?? tx.TranzactionId ?? tx.TransactionId ?? '');
 if(result.ReturnValue!==o.id || String(result.LowProfileId).toLowerCase()!==o.low_profile_id.toLowerCase() || Number(result.TerminalNumber)!==Number(config.terminal) || Math.round(Number(tx.Amount)*100)!==Number(o.amount_agorot) || Number(tx.CoinId)!==1 || !/^[1-9][0-9]*$/.test(transaction) || tx.IsRefund===true || result.Operation!=='ChargeAndCreateToken')throw new Error('payment_verification_failed');
 const token=result.TokenInfo;
 if(!token?.Token || !Number.isInteger(Number(token.CardMonth)) || Number(token.CardMonth)<1 || Number(token.CardMonth)>12 || Number(token.CardYear)<2026){
  checked(await db.from('dealer_billing_orders').update({status:'review',transaction_id:transaction,failure_code:'missing_token'}).eq('id',o.id));
  return 'review';
 }
 checked(await db.rpc('confirm_dealer_setup',{p_order:o.id,p_transaction:transaction,p_token:token.Token,p_expiration:String(token.CardMonth).padStart(2,'0')+String(token.CardYear).slice(-2),p_document:result.DocumentInfo?.DocumentNumber?String(result.DocumentInfo.DocumentNumber):null,p_document_ok:result.DocumentInfo?.ResponseCode===0 && Boolean(result.DocumentInfo.DocumentNumber)}));
 return 'paid';
}

Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS'};
 if(origin && origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 const action=new URL(req.url).searchParams.get('action');
 try {
  if(Number(req.headers.get('content-length')??0)>16384)return reply({error:'request_too_large'},413);
  const config=checked(await db.rpc('switchapp_payment_config'));
  if(!config?.api_name)return reply({error:'billing_not_configured'},503);
  if(action==='health')return reply({ready:Boolean(config?.api_name),provider:'cardcom',charges_performed:0});
  if(action==='webhook'){
   let body:any=Object.fromEntries(new URL(req.url).searchParams);
   if(req.method==='POST'){
    const text=await req.text();if(text.length>16384)return reply({error:'request_too_large'},413);
    try{body=JSON.parse(text);}catch{body=Object.fromEntries(new URLSearchParams(text));}
   }
   const low=body.LowProfileId ?? body.lowprofileid ?? body.lowprofilecode;
   if(!uuid.test(low??''))return reply({error:'invalid_payment'},400);
   const o=checked(await db.from('dealer_billing_orders').select('*').eq('low_profile_id',low).eq('kind','setup').maybeSingle());
   if(!o)return reply({error:'unknown_payment'},404);
   return reply({status:await verifySetup(o,config)});
  }
  if(action==='close-month'){
   if(req.method!=='POST' || req.headers.get('x-billing-secret')!==config.cron_secret)return reply({error:'unauthorized'},401);
   checked(await db.rpc('prepare_dealer_monthly_orders'));
   const orders=checked(await db.from('dealer_billing_orders').select('*').eq('kind','monthly').in('status',['pending','processing']).order('created_at').limit(20));
   let paid=0,failed=0;
   for(const o of orders){
    try {
     const a=checked(await db.from('dealer_billing_accounts').select('*').eq('user_id',o.user_id).single());
     const token=checked(await db.from('dealer_payment_tokens').select('*').eq('user_id',o.user_id).single());
     checked(await db.from('dealer_billing_orders').update({status:'processing'}).eq('id',o.id).in('status',['pending','processing']));
     if(Number(o.amount_agorot)===0){checked(await db.rpc('complete_dealer_monthly_order',{p_order:o.id,p_transaction:null,p_document:null}));paid++;continue;}
     // Repeating this exact ID returns the original result and cannot charge twice.
     const result=await cardcom('Transactions/Transaction',{Amount:o.amount_agorot/100,Token:token.token,CardExpirationMMYY:token.expiration,ISOCoinId:1,NumOfPayments:1,ExternalUniqTranId:o.id,ExternalUniqTranIdResponse:true,Document:documentFor(a,o)},config);
     const tid=String(result.TranzactionId??'');
     if(Number(result.ResponseCode)===0 && /^[1-9][0-9]*$/.test(tid) && Math.round(Number(result.Amount)*100)===Number(o.amount_agorot) && Number(result.CoinId)===1 && Number(result.TerminalNumber)===Number(config.terminal)){
      checked(await db.rpc('complete_dealer_monthly_order',{p_order:o.id,p_transaction:tid,p_document:result.DocumentNumber?String(result.DocumentNumber):null}));paid++;
     }else{
      checked(await db.from('dealer_billing_orders').update({status:tid && tid!=='0'?'review':'failed',failure_code:String(result.ResponseCode??'invalid_response')}).eq('id',o.id));failed++;
     }
    }catch{failed++;console.error('Monthly payment requires retry or review',{order:o.id});}
   }
   return reply({paid,failed});
  }
  // All customer operations require a JWT verified by Supabase Auth, not decoded locally.
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!bearer)return reply({error:'unauthorized'},401);
  const auth=await db.auth.getUser(bearer);
  if(auth.error || !auth.data.user)return reply({error:'unauthorized'},401);
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(origin && !origins.has(origin))return reply({error:'invalid_origin'},403);
  const user=auth.data.user;
  const text=await req.text();if(text.length>16384)return reply({error:'request_too_large'},413);
  const body=JSON.parse(text);
  if(body.action==='checkout'){
   if(body.accepted!==true || !['small','lot'].includes(body.plan))return reply({error:'accept_terms'},400);
   const name=clean(body.legal_name),tax=clean(body.tax_id),email=clean(body.email);
   if(name.length<2 || !/^\d{9}$/.test(tax) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'invalid_details'},400);
   const o=checked(await db.rpc('begin_dealer_setup',{p_user:user.id,p_plan:body.plan,p_name:name,p_tax:tax,p_email:email}));
   if(o.status==='paid')return reply({status:'paid'});
   if(o.payment_url)return reply({url:o.payment_url});
   const claim=checked(await db.from('dealer_billing_orders').update({status:'creating'}).eq('id',o.id).eq('status','pending').select('id').maybeSingle());
   if(!claim)return reply({error:'payment_preparation_pending'},409);
   const account=checked(await db.from('dealer_billing_accounts').select('*').eq('user_id',user.id).single());
   const result=await cardcom('LowProfile/Create',{Amount:3000,Operation:'ChargeAndCreateToken',ReturnValue:o.id,ProductName:'SwitchApp — הקמה חד פעמית',Language:'he',ISOCoinId:1,SuccessRedirectUrl:site+'/business/billing?order='+o.id,FailedRedirectUrl:site+'/business/billing?payment=failed',CancelRedirectUrl:site+'/business/billing?payment=cancelled',WebHookUrl:url+'/functions/v1/dealer-billing?action=webhook',UIDefinition:{CardOwnerNameValue:name,CardOwnerEmailValue:email,IsCardOwnerEmailRequired:true},Document:documentFor(account,o)},config);
   if(Number(result.ResponseCode)!==0 || !uuid.test(result.LowProfileId??'') || !result.Url){checked(await db.from('dealer_billing_orders').update({status:'review',failure_code:String(result.ResponseCode??'create_failed')}).eq('id',o.id));return reply({error:'payment_provider_rejected',code:result.ResponseCode},502);}
   const redirect=new URL(result.Url);if(redirect.protocol!=='https:' || !(redirect.hostname==='cardcom.solutions' || redirect.hostname.endsWith('.cardcom.solutions')))throw new Error('invalid_payment_url');
   checked(await db.from('dealer_billing_orders').update({status:'pending',low_profile_id:result.LowProfileId,payment_url:result.Url}).eq('id',o.id));
   return reply({url:result.Url});
  }
  if(body.action==='verify'){
   if(!uuid.test(body.order??''))return reply({error:'invalid_order'},400);
   const o=checked(await db.from('dealer_billing_orders').select('*').eq('id',body.order).eq('user_id',user.id).eq('kind','setup').maybeSingle());
   if(!o?.low_profile_id)return reply({error:'unknown_order'},404);
   return reply({status:await verifySetup(o,config)});
  }
  if(body.action==='cancel'){
   checked(await db.from('dealer_billing_accounts').update({state:'cancelled',cancelled_at:new Date().toISOString()}).eq('user_id',user.id).eq('state','active'));
   return reply({status:'cancelled'});
  }
  return reply({error:'unknown_action'},400);
 }catch(error){console.error('Billing request failed',{type:error instanceof Error?error.message:'unknown'});return reply({error:'billing_request_failed'},503);}
});
