"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { DEALER_MONTHLY_PRICE, CAMPAIGN_MANAGEMENT_RATE, saleCommission } from "@/lib/dealerPricing";

const copy = {
 he: { title: "מה כלול בשירות?", services: "אחסון ושרתים, תחזוקה ועדכוני מערכת, אבטחת המערכת והמידע, ניהול מאגר הרכבים וחיבור לנתוני הרכב הציבוריים של משרד התחבורה — בהתאם לזמינותם.", billing: "איך מחושב החיוב?", rule: "499 ₪ לחודש לכל ספק שירות, כולל הקמה וניהול מלאי. המחיר קבוע ואינו תלוי במספר הרכבים. פרסום בתוספת תשלום.", budget: "תקציב פרסום חודשי לבחירתכם (₪)", campaign: "קמפיינים בתקציב שלכם", campaignText: "אתם בוחרים את תקציב הפרסום. דמי ניהול בשיעור 20% נוספים להוצאות הפרסום בפועל. המחשבון מציג אומדן לפי התקציב שבחרתם; החיוב מתבסס על ההוצאה בפועל.", maintenance: "אחזקה חודשית", media: "תקציב מדיה", fee: "דמי ניהול 20%", total: "אומדן חודשי לפני עמלות מכירה", setup: "ההקמה כלולה במנוי — ללא תשלום חד־פעמי", vat: "דמי המנוי והפרסום כוללים מע״מ. עמלת מכירה: 3% בתוספת מע״מ. העמלה חלה על מכירה שהושלמה דרך הבוטים ואומתה, ולא על פנייה בלבד.", calculator: "התאימו את ההצעה לעסק שלכם", payment: "סגירת החודש וחיוב יתבצעו לפי תנאי המנוי והרשאת החיוב. מסמך תשלום יישלח לאחר אישור העסקה." },
 en: { title: "Included services", services: "Hosting and servers, maintenance and updates, system and information security, vehicle database management and access to public Ministry of Transport vehicle data, subject to availability.", billing: "How billing is calculated", rule: "₪499 per month for every service provider, including setup and inventory management. The price does not depend on vehicle count. Advertising is charged separately.", budget: "Your monthly advertising budget (₪)", campaign: "Campaigns with your budget", campaignText: "Choose your advertising budget. A 20% management fee is added to actual advertising spend. The calculator is an estimate; billing uses actual spend.", maintenance: "Monthly maintenance", media: "Media budget", fee: "Management fee 20%", total: "Monthly estimate excluding sale commissions", setup: "Setup is included — no one-time fee", vat: "Subscription and advertising figures include VAT. Sale commission is 3% plus VAT on completed and verified sales through the platform bots; a lead alone does not incur commission.", calculator: "Build your business proposal", payment: "Month-end billing is subject to subscription terms and payment authorization. A payment document is sent after a successful transaction." }
};

export default function PricingDetails() {
 const { locale, t } = useLocale();
 const c = locale === "he" ? copy.he : copy.en;
 const [budget, setBudget] = useState(0);
 const [plan, setPlan] = useState("paid");
 const [salePrice, setSalePrice] = useState(100000);
 const commission = salePrice > 0 ? saleCommission(salePrice) : {fee:0,vat:0,total:0};
 const monthly = plan === "free" ? 0 : DEALER_MONTHLY_PRICE;
 const fee = Math.round(budget * CAMPAIGN_MANAGEMENT_RATE * 100) / 100;
 const money = (value: number) => new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(value);
 return <section className="mx-auto max-w-6xl space-y-8 px-5 py-12" dir={locale === "he" ? "rtl" : "ltr"} lang={locale === "he" ? "he" : "en"}>
   <div className="grid gap-6 md:grid-cols-2">
    <article className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">{c.title}</h2><p className="mt-3 leading-7 text-slate-600">{c.services}</p></article>
    <article className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">{c.billing}</h2><p className="mt-3 leading-7 text-slate-600">{t("businessJoin.minimumInventory")}</p></article>
   </div>
   <article className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
    <h2 className="text-2xl font-bold">{c.calculator}</h2>
    <label className="mt-6 block"><span>{c.maintenance}</span><select className="field mt-2 bg-white text-slate-900" value={plan} onChange={e=>setPlan(e.target.value)}><option value="free">{t("businessJoin.freePlanPrice")}</option><option value="paid">{t("businessJoin.paidPlanPrice")}</option></select></label>
    <h3 className="mt-8 text-lg font-bold">{c.campaign}</h3><p className="mt-2 leading-7 text-slate-300">{c.campaignText}</p>
    <label className="mt-4 block space-y-2"><span>{c.budget}</span><input type="number" min="0" max="10000000" step="100" className="field bg-white text-slate-900" value={budget} onChange={e=>setBudget(Math.min(10000000,Math.max(0,Number(e.target.value)||0)))}/></label>
    <dl className="mt-6 space-y-3" aria-live="polite"><div className="flex justify-between gap-3"><dt>{c.maintenance}</dt><dd>{money(monthly)}</dd></div><div className="flex justify-between gap-3"><dt>{c.media}</dt><dd>{money(budget)}</dd></div><div className="flex justify-between gap-3"><dt>{c.fee}</dt><dd>{money(fee)}</dd></div><div className="flex justify-between gap-3 border-t border-white/20 pt-4 text-xl font-bold"><dt>{c.total}</dt><dd>{money(monthly+budget+fee)}</dd></div></dl>
    <div className="mt-8 border-t border-white/20 pt-5"><p className="leading-7">{t("businessJoin.saleTerms")}</p><label className="mt-4 block"><span>{locale === "he" ? "מחיר מכירת רכב לדוגמה (₪)" : "Example vehicle sale price (₪)"}</span><input type="number" min="0" max="100000000" step="1000" value={salePrice} onChange={e=>setSalePrice(Math.min(100000000,Math.max(0,Number(e.target.value)||0)))} className="field mt-2 bg-white text-slate-900"/></label><dl className="mt-4 space-y-3" aria-live="polite"><div className="flex justify-between"><dt>3%</dt><dd>{money(commission.fee)}</dd></div><div className="flex justify-between"><dt>{locale === "he" ? "מע״מ על העמלה (18%)" : "VAT on commission (18%)"}</dt><dd>{money(commission.vat)}</dd></div><div className="flex justify-between font-bold"><dt>{locale === "he" ? "סה״כ עמלה למכירה אחת" : "Total commission for one sale"}</dt><dd>{money(commission.total)}</dd></div></dl></div><p className="mt-5 font-bold text-blue-200">{c.setup}</p><p className="mt-3 text-sm leading-6 text-slate-300">{c.vat}</p><p className="mt-3 text-sm leading-6 text-slate-300">{c.payment}</p>
   </article>
 </section>;
}
