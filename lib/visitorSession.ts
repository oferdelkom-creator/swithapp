import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase/config";

export const VISITOR_COOKIE = "switchapp_visitor";
export const VISITOR_INTENTS = ["buy", "sell", "swap", "business"] as const;
export type VisitorIntent = typeof VISITOR_INTENTS[number];
export function visitorService() {
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY;
 if(!key)throw new Error("visitor_not_configured");
 return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function tokenHash(token:string){return createHash("sha256").update(token).digest("hex");}
export function newVisitorToken(){return randomBytes(32).toString("hex");}
export function validateVisitorDetails(value:unknown){
 const data=value as {name?:unknown;phone?:unknown;consent?:unknown};
 if(!data||typeof data.name!=="string"||typeof data.phone!=="string"||data.consent!==true)throw new Error("invalid_details");
 const name=data.name.trim().replace(/\s+/g," ");
 let phone=data.phone.replace(/[\s().-]/g,"");
 if(/^0\d{8,9}$/.test(phone))phone="+972"+phone.slice(1);
 if(/^972\d{8,9}$/.test(phone))phone="+"+phone;
 if(name.length<2||name.length>80||/[<>\x00-\x1f]/.test(name)||!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error("invalid_details");
 return {name,phone};
}
export function requestBucket(request:Request,purpose:string){
 const address=(request.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim();
 const salt=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY??"";
 return `${purpose}:${tokenHash(salt+address)}`;
}
export async function consumeVisitorLimit(bucket:string,limit:number){
 const {data,error}=await visitorService().rpc("consume_visitor_request",{p_bucket:bucket,p_limit:limit});
 if(error)throw new Error("visitor_unavailable");return data===true;
}
export async function getVisitorSession(){
 const token=(await cookies()).get(VISITOR_COOKIE)?.value;
 if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
 const {data,error}=await visitorService().from("visitor_contacts").select("id,contact_name,intent").eq("session_token_hash",tokenHash(token)).gt("expires_at",new Date().toISOString()).maybeSingle<{id:string;contact_name:string;intent:VisitorIntent|null}>();
 if(error)throw new Error("visitor_unavailable");return data;
}
