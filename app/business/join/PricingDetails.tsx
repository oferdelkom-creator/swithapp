"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { monthlyInventoryPrice } from "@/lib/dealerPricing";

const copy = {
 he: { title: "מה כלול בשירות?", services: "אחסון ושרתים, תחזוקה ועדכוני מערכת, אבטחת המערכת והמידע, ניהול מאגר הרכבים וחיבור לנתוני הרכב הציבוריים של משרד התחבורה — בהתאם לזמינותם.", billing: "איך מחושב החיוב?", rule: "החיוב החודשי מחושב לפי הכמות המרבית של רכבים פעילים שהיו במהלך החודש, ולא רק לפי הכמות ביום האחרון. הסרת רכב אינה מורידה את השיא שנרשם. רכב פעיל הוא רכב שלא סומן כנמכר ומוצע למכירה או להחלפה.", small: "סוחר קטן — עד 10 רכבים", lot: "מגרש — מינימום 2,000 ₪ בחודש", peak: "שיא רכבים פעילים בחודש", budget: "תקציב פרסום חודשי לבחירתכם (₪)", campaign: "קמפיינים בתקציב שלכם", campaignText: "אתם בוחרים את תקציב הפרסום. דמי ניהול בשיעור 20% נוספים להוצאות הפרסום בפועל. המחשבון מציג אומדן לפי התקציב שבחרתם; החיוב מתבסס על ההוצאה בפועל.", maintenance: "אחזקה חודשית", media: "תקציב מדיה", fee: "דמי ניהול 20%", total: "אומדן חודשי כולל", setup: "בנוסף: 3,000 ₪ הקמת פלטפורמה ואולם תצוגה, חד־פעמי", vat: "כל הסכומים כוללים מע״מ. מינימום החיוב במסלול מגרש חל גם על פחות מ־40 רכבים; מעל 40 — 50 ₪ לכל רכב.", calculator: "התאימו את ההצעה לעסק שלכם", payment: "סגירת החודש וחיוב יתבצעו לפי תנאי המנוי והרשאת החיוב. מסמך תשלום יישלח לאחר אישור העסקה." },
 en: { title: "Included services", services: "Hosting and servers, maintenance and updates, system and information security, vehicle database management and access to public Ministry of Transport vehicle data, subject to availability.", billing: "How billing is calculated", rule: "Monthly maintenance uses the highest number of active vehicles during the month. Removing a vehicle does not reduce the recorded peak. Active vehicles are unsold vehicles offered for sale or swap.", small: "Small dealer — up to 10 vehicles", lot: "Lot — minimum ₪2,000/month", peak: "Peak active vehicles this month", budget: "Your monthly advertising budget (₪)", campaign: "Campaigns with your budget", campaignText: "Choose your advertising budget. A 20% management fee is added to actual advertising spend. The calculator is an estimate; billing uses actual spend.", maintenance: "Monthly maintenance", media: "Media budget", fee: "Management fee 20%", total: "Estimated monthly total", setup: "Plus ₪3,000 one-time platform and digital showroom setup", vat: "All amounts include VAT. The lot minimum applies below 40 vehicles; above 40, each vehicle costs ₪50.", calculator: "Build your business proposal", payment: "Month-end billing is subject to subscription terms and payment authorization. A payment document is sent after a successful transaction." }
};

export default function PricingDetails() {
 const { locale } = useLocale();
 const c = locale === "he" ? copy.he : copy.en;
 const [plan, setPlan] = useState<"small" | "lot">("small");
 const [peak, setPeak] = useState(10);
 const [budget, setBudget] = useState(0);
 const monthly = monthlyInventoryPrice(plan, peak);
 const fee = Math.round(budget * 20) / 100;
 const money = (value: number) => new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(value);
 return <section className="mx-auto max-w-6xl space-y-8 px-5 py-12" dir={locale === "he" ? "rtl" : "ltr"} lang={locale === "he" ? "he" : "en"}>
   <div className="grid gap-6 md:grid-cols-2">
    <article className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">{c.title}</h2><p className="mt-3 leading-7 text-slate-600">{c.services}</p></article>
    <article className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">{c.billing}</h2><p className="mt-3 leading-7 text-slate-600">{c.rule}</p></article>
   </div>
   <article className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
    <h2 className="text-2xl font-bold">{c.calculator}</h2>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="space-y-2"><span>{c.maintenance}</span><select className="field bg-white text-slate-900" value={plan} onChange={e=>{const p=e.target.value as "small"|"lot";setPlan(p);if(p==='small')setPeak(Math.min(10,peak));}}><option value="small">{c.small}</option><option value="lot">{c.lot}</option></select></label>
      <label className="space-y-2"><span>{c.peak}</span><input type="number" min="0" max={plan==='small'?10:100000} step="1" className="field bg-white text-slate-900" value={peak} onChange={e=>setPeak(Math.min(plan==='small'?10:100000,Math.max(0,Math.floor(Number(e.target.value)||0))))}/></label>
    </div>
    <h3 className="mt-8 text-lg font-bold">{c.campaign}</h3><p className="mt-2 leading-7 text-slate-300">{c.campaignText}</p>
    <label className="mt-4 block space-y-2"><span>{c.budget}</span><input type="number" min="0" max="10000000" step="100" className="field bg-white text-slate-900" value={budget} onChange={e=>setBudget(Math.min(10000000,Math.max(0,Number(e.target.value)||0)))}/></label>
    <dl className="mt-6 space-y-3" aria-live="polite"><div className="flex justify-between gap-3"><dt>{c.maintenance}</dt><dd>{money(monthly)}</dd></div><div className="flex justify-between gap-3"><dt>{c.media}</dt><dd>{money(budget)}</dd></div><div className="flex justify-between gap-3"><dt>{c.fee}</dt><dd>{money(fee)}</dd></div><div className="flex justify-between gap-3 border-t border-white/20 pt-4 text-xl font-bold"><dt>{c.total}</dt><dd>{money(monthly+budget+fee)}</dd></div></dl>
    <p className="mt-5 font-bold text-blue-200">{c.setup}</p><p className="mt-3 text-sm leading-6 text-slate-300">{c.vat}</p><p className="mt-3 text-sm leading-6 text-slate-300">{c.payment}</p>
   </article>
 </section>;
}
