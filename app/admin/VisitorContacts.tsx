"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Contact={id:string;contact_name:string;phone_e164:string;intent:string|null;created_at:string};
const purposes:Record<string,string>={buy:"קנייה",sell:"מכירה",swap:"החלפה",business:"שירות לעסק"};
export default function VisitorContacts(){
 const [contacts,setContacts]=useState<Contact[]>([]),[error,setError]=useState("");
 useEffect(()=>{let stopped=false;createClient().from("visitor_contacts").select("id,contact_name,phone_e164,intent,created_at").order("created_at",{ascending:false}).limit(100).then(({data,error})=>{if(!stopped){setContacts(data??[]);if(error)setError("לא ניתן לטעון פניות לקוחות.");}});return()=>{stopped=true;};},[]);
 return <section className="card space-y-4 p-6" dir="rtl"><h2 className="text-xl font-bold">לקוחות שנכנסו דרך העוזר בדף הבית</h2><p className="text-sm text-slate-500">שם, טלפון ומטרת הביקור. מספר הטלפון נמסר על ידי הלקוח ולא אומת ב־SMS.</p>{error&&<p role="status">{error}</p>}{contacts.length?<div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr><th className="p-2 text-start">שם</th><th className="p-2 text-start">טלפון</th><th className="p-2 text-start">מטרה</th><th className="p-2 text-start">נוצרה</th></tr></thead><tbody>{contacts.map(c=><tr key={c.id} className="border-t"><td className="p-2">{c.contact_name}</td><td className="p-2" dir="ltr">{c.phone_e164}</td><td className="p-2">{c.intent?purposes[c.intent]:"טרם נבחרה"}</td><td className="p-2">{new Date(c.created_at).toLocaleDateString("he-IL")}</td></tr>)}</tbody></table></div>:<p className="text-sm">אין עדיין פניות.</p>}</section>;
}
