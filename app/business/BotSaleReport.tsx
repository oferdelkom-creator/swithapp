"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saleCommission } from "@/lib/dealerPricing";

type Car = { id:string; make:string; model:string; price:number|null; sold_at:string|null };
export default function BotSaleReport({ cars }: { cars:Car[] }) {
 const router=useRouter();
 const [car,setCar]=useState(""),[price,setPrice]=useState(""),[reference,setReference]=useState(""),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const value=Number(price); const fee=value>0&&value<=100000000?saleCommission(value):null;
 async function submit(event:React.FormEvent){event.preventDefault();if(!accepted||!fee)return;setBusy(true);setNotice("");try{
  const {error}=await createClient().rpc("report_bot_vehicle_sale",{p_car:car,p_sale_price:value,p_bot_reference:reference.trim(),p_accepted:true});
  setNotice(error?"לא ניתן לשמור. בדקו את הפרטים וודאו שהמכירה לא דווחה כבר.":"המכירה דווחה ונשלחה לאימות. העמלה לא נגבתה אוטומטית.");
  if(!error){setCar("");setPrice("");setReference("");setAccepted(false);router.refresh();}
 }catch{setNotice("שמירת הדיווח נכשלה. נסו שוב.");}finally{setBusy(false);}}
 return <section className="card space-y-4 p-6" dir="rtl"><h2 className="font-bold">דיווח מכירה דרך הבוטים</h2><p className="text-sm leading-7">בשני המסלולים: 3% ממחיר המכירה בפועל, בתוספת מע״מ. צוות הפלטפורמה מאמת שהעסקה הושלמה דרך הבוט לפני אישור העמלה.</p>
  <form onSubmit={submit} className="space-y-3"><label className="block text-sm">רכב שנמכר<select required value={car} onChange={e=>{setCar(e.target.value);setPrice(String(cars.find(c=>c.id===e.target.value)?.price??""));}} className="field mt-1"><option value="">בחירת רכב</option>{cars.filter(c=>!c.sold_at).map(c=><option key={c.id} value={c.id}>{c.make} {c.model}</option>)}</select></label>
   <label className="block text-sm">מחיר המכירה בפועל (₪)<input type="number" required min="0.01" max="100000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className="field mt-1"/></label>
   <label className="block text-sm">אסמכתה לפנייה מהבוט<input required minLength={5} maxLength={500} value={reference} onChange={e=>setReference(e.target.value)} placeholder="מזהה פנייה או קישור לשיחה" className="field mt-1"/></label>
   {fee&&<p className="rounded-xl bg-blue-50 p-3 text-sm">עמלה: {fee.fee.toFixed(2)} ₪ + {fee.vat.toFixed(2)} ₪ מע״מ = {fee.total.toFixed(2)} ₪</p>}
   <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1"/><span>אני מאשר/ת שהרכב נמכר דרך הבוט, שמחיר העסקה נכון ושעמלת המכירה היא 3% בתוספת מע״מ. הרכב יסומן כנמכר עם הדיווח.</span></label>
   <button disabled={busy||!accepted||!fee} className="btn-primary w-full">{busy?"שומר…":"דיווח ושליחה לאימות"}</button>
  </form>{notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
