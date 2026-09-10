"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import Link from 'next/link';

type Account={plan:string;legal_name:string;tax_id:string;email:string;state:string;activated_at:string|null;cancelled_at:string|null};
type Order={id:string;kind:string;period:string|null;peak:number;amount_agorot:number;status:string;document_number:string|null;document_status:string|null};
export default function BillingPanel({initialPlan,initialName,initialEmail,account,orders}:{initialPlan:'small'|'lot';initialName:string;initialEmail:string;account:Account|null;orders:Order[]}){
 const router=useRouter();const [plan,setPlan]=useState(account?.plan||initialPlan);
 const [name,setName]=useState(account?.legal_name||initialName),[tax,setTax]=useState(account?.tax_id||''),[email,setEmail]=useState(account?.email||initialEmail);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[cancelConfirm,setCancelConfirm]=useState(false);
 useEffect(()=>{
  const order=new URLSearchParams(window.location.search).get('order');if(!order)return;
  let stopped=false;
  createClient().functions.invoke('dealer-billing',{body:{action:'verify',order}}).then(({data,error})=>{if(stopped)return;setNotice(error?'אישור התשלום עדיין בבדיקה. אין לבצע חיוב נוסף.':data?.status==='paid'?'תשלום ההקמה אושר. המנוי פעיל.':'אישור התשלום עדיין בבדיקה. אין לבצע חיוב נוסף.');router.refresh();});
  return()=>{stopped=true;};
 },[router]);
 async function checkout(e:React.FormEvent){e.preventDefault();if(!accepted)return;setBusy(true);setNotice('');try{
  const {data,error}=await createClient().functions.invoke('dealer-billing',{body:{action:'checkout',plan,legal_name:name,tax_id:tax,email,accepted}});
  if(error||data?.error){setNotice('לא ניתן לפתוח תשלום כרגע. בדקו את הפרטים; אם כבר התחלתם תשלום, פנו אלינו לבדיקה לפני ניסיון נוסף.');return;}
  if(data?.url){const u=new URL(data.url);if(u.protocol!=='https:'||!(u.hostname==='cardcom.solutions'||u.hostname.endsWith('.cardcom.solutions')))throw Error('invalid_url');window.location.assign(u.href);}else{setNotice('תשלום ההקמה כבר אושר.');router.refresh();}
 }catch{setNotice('לא הצלחנו להתחבר לשירות התשלום. נסו שוב מאוחר יותר.');}finally{setBusy(false);}}
 async function cancel(){setBusy(true);try{const {data,error}=await createClient().functions.invoke('dealer-billing',{body:{action:'cancel'}});setNotice(error||data?.error?'הביטול לא הושלם. נסו שוב.':'חידוש המנוי בוטל. החודש הנוכחי יחויב לפי תנאי המסלול.');router.refresh();}finally{setBusy(false);setCancelConfirm(false);}}
 const money=(n:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(n/100);
 return <main className="mx-auto max-w-3xl px-4 py-12 space-y-8" dir="rtl">
  <Link href="/business" className="text-blue-700">חזרה לניהול העסק</Link><h1 className="text-3xl font-bold">מנוי ותשלומים</h1>
  {notice&&<p role="status" className="rounded-xl bg-blue-50 p-4">{notice}</p>}
  {account?.state==='active'?<section className="card p-6 space-y-3"><h2 className="text-xl font-bold">המנוי פעיל — {account.plan==='small'?'סוחר קטן':'מגרש'}</h2><p>החיוב מתבצע בסגירת כל חודש לפי שיא הרכבים הפעילים. חשבונית מס־קבלה נשלחת למייל לאחר אישור התשלום.</p>{cancelConfirm?<div className="space-y-3"><p>לבטל את חידוש המנוי? החיוב עבור החודש הנוכחי יישאר לפי תנאי המסלול.</p><button disabled={busy} onClick={cancel} className="btn-primary">אישור ביטול החידוש</button><button onClick={()=>setCancelConfirm(false)} className="ms-4 underline">חזרה</button></div>:<button onClick={()=>setCancelConfirm(true)} className="underline">ביטול חידוש המנוי</button>}</section>:account?.state==='cancelled'?<p className="card p-6">חידוש המנוי בוטל. לחידוש או לשינוי מסלול, צרו איתנו קשר.</p>:<form onSubmit={checkout} className="card p-6 space-y-5">
   <h2 className="text-xl font-bold">הקמת פלטפורמה ואולם תצוגה — 3,000 ₪ חד־פעמי</h2><p>כל המחירים כוללים מע״מ.</p>
   <label className="block">מסלול אחזקה<select className="field mt-2" value={plan} disabled={Boolean(account)} onChange={e=>setPlan(e.target.value)}><option value="small">סוחר קטן — עד 10 רכבים, 100 ₪ לרכב בחודש</option><option value="lot">מגרש — 50 ₪ לרכב, מינימום 2,000 ₪ בחודש גם עם פחות מ־40 רכבים</option></select></label>
   <label className="block">שם העסק לחשבונית<input required minLength={2} maxLength={50} className="field mt-2" value={name} onChange={e=>setName(e.target.value)}/></label>
   <label className="block">ח״פ / מספר עוסק<input required pattern="[0-9]{9}" inputMode="numeric" maxLength={9} className="field mt-2" value={tax} onChange={e=>setTax(e.target.value)}/></label>
   <label className="block">מייל לחשבוניות<input required type="email" maxLength={50} className="field mt-2" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7"><p>תשלום עכשיו: 3,000 ₪ עבור ההקמה. האחזקה תחויב אוטומטית בסגירת כל חודש קלנדרי, לפי הכמות המרבית של רכבים פעילים שנרשמה מאז הפעלת המנוי באותו חודש. רכב פעיל לא סומן כנמכר ומוצע למכירה או להחלפה. הסרת רכב לא מקטינה את השיא. במסלול מגרש חל מינימום חיוב של 40 רכבים גם בחודש חלקי או כאשר יש פחות רכבים.</p><p>מסלול סוחר קטן מוגבל ל־10 רכבים פעילים; מעבר למסלול מגרש מחייב הסכמה למחיר החדש. ביטול חידוש המנוי זמין בעמוד זה; החודש הנוכחי מחויב לפי תנאי המסלול. פרטי האשראי מוזנים בקארדקום; המערכת שומרת אסימון תשלום בלבד.</p><p>קמפיינים מוזמנים בנפרד לפי תקציב שתאשרו, בתוספת 20% דמי ניהול מההוצאה בפועל. הרשאה זו מכסה את תשלום ההקמה ואת האחזקה בלבד.</p></div>
   <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1"/><span>קראתי ואני מסכים/ה למחיר ולתנאי המנוי, ומאשר/ת תשלום הקמה וחיוב חודשי משתנה בכרטיס לפי הכללים לעיל. קראתי את <Link href="/privacy" className="underline">מדיניות הפרטיות</Link>.</span></label>
   <button disabled={busy||!accepted} className="btn-primary w-full">{busy?'מכינים תשלום מאובטח…':'לתשלום הקמה — 3,000 ₪'}</button>
  </form>}
  <section className="space-y-3"><h2 className="text-xl font-bold">היסטוריית חיובים</h2>{orders.length?orders.map(o=><article key={o.id} className="card p-4"><p className="font-bold">{o.kind==='setup'?'הקמה חד־פעמית':`אחזקה ${o.period?.slice(0,7)} — שיא ${o.peak} רכבים`} · {money(o.amount_agorot)}</p><p>{o.status==='paid'?'שולם':o.status==='failed'?'החיוב נכשל — נדרש טיפול':o.status==='review'?'נדרשת בדיקה לפני חיוב נוסף':'ממתין לאישור תשלום'}</p>{o.document_number?<p>מסמך קארדקום: {o.document_number}</p>:o.status==='paid'?<p>מסמך התשלום בטיפול.</p>:null}</article>):<p>עדיין אין חיובים.</p>}</section>
 </main>;
}
