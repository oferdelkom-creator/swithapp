'use strict';
// Server-only draft. Inject createClient from pinned official @supabase/supabase-js.
const ORIGIN='https://hltpqflqngtrmprayyvd.supabase.co', ROLE='switchapp_whatsapp_runtime';
function createSupplier({createClient,subject,publishableKey,credential,now=()=>Date.now()}){
 if(typeof window!=='undefined'||typeof createClient!=='function'||typeof credential!=='function'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey||'')||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject||''))throw Error('machine_config_denied');
 let cache=null,flight=null,generation=0,closed=false;
 const valid=c=>{const n=Math.floor(now()/1000);return c&&c.iss===ORIGIN+'/auth/v1'&&c.sub===subject&&c.role===ROLE&&c.aud==='authenticated'&&c.is_anonymous===false&&!Object.hasOwn(c,'client_id')&&Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp)&&c.iat<=n&&c.exp>n+30&&c.exp>c.iat&&c.exp-c.iat<=300&&c.exp<=n+300;};
 async function issue(g){
  try{
   const client=createClient(ORIGIN,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const creds=await credential();if(closed||g!==generation)throw Error();
   if(typeof creds?.email!=='string'||typeof creds?.password!=='string'||!creds.password)throw Error();
   const result=await client.auth.signInWithPassword({email:creds.email,password:creds.password});
   const token=result?.data?.session?.access_token;if(result?.error||typeof token!=='string'||token.length>16384||token.split('.').length!==3)throw Error();
   // Official verifier, NOT a base64 decode or getSession trust check.
   const verified=await client.auth.getClaims(token);
   if(verified?.error||!valid(verified?.data?.claims)||closed||g!==generation)throw Error();
   cache={accessToken:token,exp:verified.data.claims.exp};
   return Object.freeze({accessToken:token,subject,publishableKey});
  }catch{throw Error('machine_identity_unavailable');}
 }
 return Object.freeze({
  async getCredential(){if(closed)throw Error('machine_identity_closed');if(cache&&cache.exp>Math.floor(now()/1000)+30)return Object.freeze({accessToken:cache.accessToken,subject,publishableKey});cache=null;if(!flight){const p=issue(generation);flight=p;p.finally(()=>{if(flight===p)flight=null;}).catch(()=>{});}return flight;},
  invalidate(){generation++;cache=null;},
  close(){closed=true;generation++;cache=null;}
 });
}
module.exports={createSupplier};
