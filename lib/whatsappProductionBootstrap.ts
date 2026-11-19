import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createSupplier } from './whatsappIdentitySupplier.cjs';
import { createWhatsAppMachineRpc } from './whatsappMachineRpc';
import type { WhatsAppProductionStore } from './whatsappProductionStore';
const ORIGIN='https://hltpqflqngtrmprayyvd.supabase.co';
let store: WhatsAppProductionStore | null = null;
export function getWhatsAppConfiguredStore(): WhatsAppProductionStore {
 if(process.env.WHATSAPP_PRODUCTION_ENABLED!=='1'||process.env.WHATSAPP_TEST_MODE||process.env.NEXT_PUBLIC_SUPABASE_URL!==ORIGIN)throw Error('whatsapp_closed');
 if(store)return store;
 const subject=process.env.WHATSAPP_MACHINE_UID,publishableKey=process.env.WHATSAPP_MACHINE_PUBLISHABLE_KEY;
 if(!subject||!publishableKey||!process.env.WHATSAPP_MACHINE_EMAIL||!process.env.WHATSAPP_MACHINE_PASSWORD)throw Error('machine_not_configured');
 const authFetch: typeof fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.origin!==ORIGIN||!['/auth/v1/token','/auth/v1/user','/auth/v1/.well-known/jwks.json'].includes(url.pathname)||url.username||url.password||url.hash||(url.pathname==='/auth/v1/token'&&url.search!=='?grant_type=password'))throw Error('machine_auth_target_denied');
  const signal=init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000);
  return fetch(url,{...init,redirect:'error',signal,cache:'no-store'});
 };
 const supplier=createSupplier({createClient:(url,key,options)=>createClient(url,key,{...options,global:{fetch:authFetch}}),subject,publishableKey,credential:async()=>({email:process.env.WHATSAPP_MACHINE_EMAIL!,password:process.env.WHATSAPP_MACHINE_PASSWORD!})});
 const credential=async()=>{
  let timer:ReturnType<typeof setTimeout>;
  try{return await Promise.race([supplier.getCredential(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{supplier.invalidate();reject(Error('machine_identity_timeout'));},15000);})]);}
  finally{clearTimeout(timer!);}
 };
 store=createWhatsAppMachineRpc(true,credential);
 return store;
}
