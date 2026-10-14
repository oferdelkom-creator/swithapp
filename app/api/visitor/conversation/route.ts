import {NextResponse} from 'next/server';
import {getVisitorSession,visitorService,consumeVisitorLimit,requestBucket} from '@/lib/visitorSession';
import {sendConversationReport,validateEmail,type ReportContact,type ReportConversation} from '@/lib/conversationReport';
export const maxDuration=30;
export async function POST(request:Request){
 const fail=(error:string,status:number)=>NextResponse.json({error},{status});
 try{
  const origin=request.headers.get('origin');if(!origin||new URL(origin).origin!==new URL(request.url).origin)return fail('invalid_origin',403);
  const raw=await request.text();if(raw.length>2000)return fail('invalid_request',400);
  let body;try{body=JSON.parse(raw);}catch{return fail('invalid_request',400);}
  const visitor=await getVisitorSession();if(!visitor)return fail('details_required',401);
  if(typeof body.conversationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.conversationId))return fail('invalid_request',400);
  const db=visitorService();const {data:conversation,error}=await db.from('visitor_conversations').select('*').eq('id',body.conversationId).eq('visitor_id',visitor.id).maybeSingle();
  if(error)throw Error('unavailable');if(!conversation)return fail('not_found',404);
  if(body.action==='offers'){
   if(!conversation.no_match||conversation.ended_at||body.consent!==true)return fail('not_allowed',400);
   let email;try{email=validateEmail(body.email);}catch{return fail('invalid_email',400);}
   if(!await consumeVisitorLimit(`offers:${visitor.id}`,5))return fail('hourly_limit',429);
   const {error}=await db.from('visitor_contacts').update({email,offers_consent_at:new Date().toISOString()}).eq('id',visitor.id);
   if(error)throw Error('unavailable');return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action!=='finish')return fail('invalid_request',400);
  if(conversation.report_sent_at)return NextResponse.json({sent:true});
  if(!conversation.messages.length)return fail('empty_conversation',400);
  if(!await consumeVisitorLimit(`report:${visitor.id}`,5)||!await consumeVisitorLimit(requestBucket(request,'report'),10))return fail('hourly_limit',429);
  const {data:ended,error:endedError}=await db.from('visitor_conversations').update({ended_at:conversation.ended_at??new Date().toISOString()}).eq('id',conversation.id).eq('visitor_id',visitor.id).select('*').single();
  if(endedError)throw Error('unavailable');
  const {data:contact,error:contactError}=await db.from('visitor_contacts').select('contact_name,phone_e164,email,offers_consent_at').eq('id',visitor.id).single();
  if(contactError)throw Error('unavailable');
  await sendConversationReport(contact as ReportContact,ended as ReportConversation);
  const {error:sentError}=await db.from('visitor_conversations').update({report_sent_at:new Date().toISOString()}).eq('id',conversation.id);
  if(sentError)throw Error('unavailable');
  return NextResponse.json({sent:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return fail('temporarily_unavailable',503);}
}
