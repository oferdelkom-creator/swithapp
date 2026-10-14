import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {VISITOR_COOKIE,VISITOR_INTENTS,consumeVisitorLimit,getVisitorSession,newVisitorToken,requestBucket,tokenHash,validateVisitorDetails,visitorService} from "@/lib/visitorSession";

export async function GET(){try{return NextResponse.json({visitor:await getVisitorSession()},{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"unavailable"},{status:503});}}
export async function POST(request:Request){
 const fail=(error:string,status:number)=>NextResponse.json({error},{status});
 try{
  const origin=request.headers.get("origin");if(!origin||new URL(origin).origin!==new URL(request.url).origin)return fail("invalid_origin",403);
  const text=await request.text();if(text.length>2000)return fail("invalid_details",400);
  let body;try{body=JSON.parse(text);}catch{return fail("invalid_details",400);}
  if(body.action==="intent"){
   const visitor=await getVisitorSession();if(!visitor)return fail("details_required",401);
   if(!VISITOR_INTENTS.includes(body.intent))return fail("invalid_intent",400);
   const {error}=await visitorService().from("visitor_contacts").update({intent:body.intent}).eq("id",visitor.id);
   if(error)return fail("unavailable",503);
   return NextResponse.json({visitor:{...visitor,intent:body.intent}},{headers:{"Cache-Control":"no-store"}});
  }
  let details;try{details=validateVisitorDetails(body);}catch{return fail("invalid_details",400);}
  if(!await consumeVisitorLimit(requestBucket(request,"register"),5))return fail("hourly_limit",429);
  const existing=await getVisitorSession();const token=newVisitorToken();const db=visitorService();
  const record={contact_name:details.name,phone_e164:details.phone,session_token_hash:tokenHash(token),expires_at:new Date(Date.now()+7*86400000).toISOString(),consent_at:new Date().toISOString()};
  const {data,error}=existing?await db.from("visitor_contacts").update(record).eq("id",existing.id).select("id,contact_name,intent").single():await db.from("visitor_contacts").insert(record).select("id,contact_name,intent").single();
  if(error)return fail("unavailable",503);
  (await cookies()).set(VISITOR_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:7*86400});
  return NextResponse.json({visitor:data},{headers:{"Cache-Control":"no-store"}});
 }catch{return fail("unavailable",503);}
}
