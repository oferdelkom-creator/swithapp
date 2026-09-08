"use client";

import { useMemo, useState } from "react";
import { estimateVehicleValue } from "@/lib/vehicleValuation";

const money = (n: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

export default function VehicleValuationPage() {
  const [price, setPrice] = useState(120000);
  const [year, setYear] = useState(2022);
  const [mileage, setMileage] = useState(60000);
  const [hand, setHand] = useState(2);
  const [ownership, setOwnership] = useState<"private" | "leasing" | "rental" | "commercial">("private");
  const [accidentSeverity, setAccident] = useState<"none" | "minor" | "major">("none");
  const [condition, setCondition] = useState<"excellent" | "good" | "fair" | "poor">("good");

  const valuation = useMemo(() => estimateVehicleValue({ askingPrice: price, year, mileage, hand, ownership, accidentSeverity, condition }), [price, year, mileage, hand, ownership, accidentSeverity, condition]);

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <div className="mb-7">
        <p className="font-bold text-blue-700">SwitchAuto AI</p>
        <h1 className="text-3xl font-black">כמה הרכב שווה?</h1>
        <p className="mt-2 text-slate-600">אומדן ראשוני למכירה, מכירה מהירה וטרייד. בשלב זה המחיר שהוזן משמש עוגן עד לחיבור מקור נתוני שוק מורשה.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>מחיר נוכחי / מחיר מבוקש<input className="mt-1 w-full rounded-xl border p-3" type="number" value={price} onChange={e=>setPrice(Number(e.target.value))}/></label>
            <label>שנת מודל<input className="mt-1 w-full rounded-xl border p-3" type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
            <label>קילומטראז׳<input className="mt-1 w-full rounded-xl border p-3" type="number" value={mileage} onChange={e=>setMileage(Number(e.target.value))}/></label>
            <label>יד<input className="mt-1 w-full rounded-xl border p-3" type="number" min="1" value={hand} onChange={e=>setHand(Number(e.target.value))}/></label>
            <label>בעלות<select className="mt-1 w-full rounded-xl border p-3" value={ownership} onChange={e=>setOwnership(e.target.value as typeof ownership)}><option value="private">פרטית</option><option value="leasing">ליסינג</option><option value="rental">השכרה</option><option value="commercial">מסחרית</option></select></label>
            <label>עבר תאונתי<select className="mt-1 w-full rounded-xl border p-3" value={accidentSeverity} onChange={e=>setAccident(e.target.value as typeof accidentSeverity)}><option value="none">ללא</option><option value="minor">קל</option><option value="major">משמעותי</option></select></label>
            <label>מצב כללי<select className="mt-1 w-full rounded-xl border p-3" value={condition} onChange={e=>setCondition(e.target.value as typeof condition)}><option value="excellent">מצוין</option><option value="good">טוב</option><option value="fair">בינוני</option><option value="poor">דורש טיפול</option></select></label>
          </div>
        </section>
        {valuation && <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm text-slate-300">טווח שוק משוער</p>
          <p className="mt-1 text-3xl font-black">{money(valuation.marketLow)} – {money(valuation.marketHigh)}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Box title="מחיר פרסום מומלץ" value={money(valuation.recommendedListing)}/>
            <Box title="מכירה מהירה" value={`${money(valuation.quickSaleLow)} – ${money(valuation.quickSaleHigh)}`}/>
            <Box title="שווי טרייד משוער" value={`${money(valuation.tradeLow)} – ${money(valuation.tradeHigh)}`}/>
          </div>
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <p className="font-bold">מה השפיע על האומדן?</p>
            <p className="mt-2 text-sm text-slate-300">{valuation.factors.length ? valuation.factors.join(" • ") : "לא הופעלו התאמות מיוחדות."}</p>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-400">האומדן אינו שמאות ואינו מחירון רשמי. לפני השקה מסחרית נחבר נתוני השוואה מורשים ונציג מקור נתונים ורמת ביטחון.</p>
        </section>}
      </div>
    </div>
  </main>;
}

function Box({title,value}:{title:string;value:string}) { return <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">{title}</p><p className="mt-2 font-bold">{value}</p></div>; }
