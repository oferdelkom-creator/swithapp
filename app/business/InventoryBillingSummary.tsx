import { createClient } from "@/lib/supabase/server";

export default async function InventoryBillingSummary({ userId }: { userId: string }) {
 const supabase = await createClient();
 const month = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).slice(0,7)+'-01';
 const {data,error}=await supabase.rpc('dealer_monthly_peak',{p_month:month}).eq('user_id',userId).maybeSingle<{user_id:string;peak:number;tracking_started_at:string}>();
 if(error || !data) return null;
 return <section className="card p-6 space-y-3" dir="rtl">
  <h2 className="font-bold">כמות רכבים לחיוב החודש</h2>
  <p className="text-3xl font-bold">{data.peak}</p>
  <p className="text-sm text-neutral-600">הכמות המרבית של רכבים פעילים שנרשמה החודש. מכירה או הסרה של רכב אינה מפחיתה את השיא.</p>
  <p className="text-xs text-neutral-500">המדידה החלה ב־{new Date(data.tracking_started_at).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'})}. אין שחזור של שיאים מלפני תחילת המדידה.</p>
  <a className="text-blue-700 underline" href="/business/join#pricing">מחירון ותנאי החיוב — כולל מע״מ</a>
  <a className="block text-blue-700 underline" href="/business/billing">מנוי, חשבוניות ואמצעי תשלום</a>
 </section>;
}
