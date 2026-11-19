import { after } from 'next/server';
import { validateRequest } from 'twilio';
import { processWhatsAppMessage, readTwilioCreds, whatsappService } from '@/lib/whatsappProcessor';
export const runtime = 'nodejs';
export const maxDuration = 60;
const CANONICAL = 'https://www.switchapp.co.il/api/whatsapp/webhook';
const ack = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
async function form(request: Request): Promise<Record<string,string>> {
 if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') throw Error();
 const reader=request.body?.getReader(); if(!reader)throw Error();
 const chunks:Uint8Array[]=[];let size=0;let timer:ReturnType<typeof setTimeout>;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('body_timeout')),10000);});
 try {
  while(true){const x=await Promise.race([reader.read(),timeout]);if(x.done)break;size+=x.value.byteLength;if(size>8192)throw Error();chunks.push(x.value);}
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
  const params:Record<string,string>=Object.create(null);
  for(const [k,v] of new URLSearchParams(raw)){if(Object.hasOwn(params,k))throw Error();params[k]=v;}
  return params;
 }finally{clearTimeout(timer!);void reader.cancel().catch(()=>{});}
}
export async function POST(request: Request){
 const creds=readTwilioCreds();
 if(!creds||process.env.WHATSAPP_WEBHOOK_URL!==CANONICAL)return new Response('not_configured',{status:503});
 let params:Record<string,string>;
 try{params=await form(request);}catch{return new Response('invalid',{status:400});}
 const signature=request.headers.get('x-twilio-signature')??'';
 if(!validateRequest(creds.authToken,signature,CANONICAL,params))return new Response('forbidden',{status:403});
 if(params.AccountSid!==creds.accountSid||params.To!==creds.from||!/^whatsapp:\+[1-9]\d{7,14}$/.test(params.From??'')||!/^SM[0-9a-f]{32}$/i.test(params.MessageSid??'')||(params.SmsMessageSid!==undefined&&params.SmsMessageSid!==params.MessageSid)||!params.Body?.trim()||params.Body.length>2000)return new Response('invalid',{status:400});
 const phone=params.From.slice('whatsapp:'.length),body=params.Body.trim(),sid=params.MessageSid;
 try{
  const db=whatsappService(),result=await db.claimInbound(sid,creds.accountSid,params.From,params.To,body);
  if(result.error||!result.data)return new Response('unavailable',{status:503});
  if(result.data.status==='denied')return new Response('forbidden',{status:403});
  if(result.data.status==='duplicate'||result.data.status==='queued')return ack();
  if(result.data.status!=='claimed')return new Response('unavailable',{status:503});
  const token=result.data.token;
  after(async()=>{try{await processWhatsAppMessage(db,creds,sid,phone,body,token);}catch{/* persisted lease/journal governs recovery; no provider retry here */}});
  return ack();
 }catch{return new Response('unavailable',{status:503});}
}
