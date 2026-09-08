"use client";

import { useMemo, useState } from "react";
import { estimateVehicleValue } from "@/lib/vehicleValuation";

const money = (n: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

type PlateResult = {
  plate?: string;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  year?: number | null;
  color?: string | null;
  fuel_type_raw?: string | null;
  ownership_raw?: string | null;
  first_registration_date?: string | null;
};

export default function VehicleValuationPage() {
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState<PlateResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [price, setPrice] = useState(120000);
  const [year, setYear] = useState(2022);
  const [mileage, setMileage] = useState(60000);
  const [hand, setHand] = useState(2);
  const [ownership, setOwnership] = useState<"private" | "leasing" | "rental" | "commercial">("private");
  const [accidentSeverity, setAccident] = useState<"none" | "minor" | "major">("none");
  const [condition, setCondition] = useState<"excellent" | "good" | "fair" | "poor">("good");

  const valuation = useMemo(() => estimateVehicleValue({ askingPrice: price, year, mileage, hand, ownership, accidentSeverity, condition }), [price, year, mileage, hand, ownership, accidentSeverity, condition]);

  async function lookupPlate(e: React.FormEvent) {
    e.preventDefault();
    const clean = plate.replace(/\D/g, "");
    if (!clean) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/plate-lookup?plate=${encodeURIComponent(clean)}&type=car`);
      if (res.status === 404) {
        setLookupError("לא נמצא רכב פעיל עם מספר הרישוי הזה במאגר משרד התחבורה.");
        setVehicle(null);
        return;
      }
      if (!res.ok) throw new Error("lookup_failed");
      const data: PlateResult = await res.json();
      setVehicle(data);
      if (data.year) setYear(data.year);
      const raw = data.ownership_raw || "";
      if (/ליסינג/.test(raw)) setOwnership("leasing");
      else if (/השכר/.test(raw)) setOwnership("rental");
      else if (/חברה|מסחרי/.test(raw)) setOwnership("commercial");
      else if (raw) setOwnership("private");
    } catch {
      setLookupError("לא הצלחנו להתחבר כרגע למאגר משרד התחבורה. אפשר להמשיך ידנית ולנסות שוב בהמשך.");
    } finally {
      setLookupLoading(false);
    }
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <div className="mb-7">
        <p className="font-bold text-blue-700">SwitchAuto AI</p>
        <h1 className="text-3xl font-black">כמה הרכב שווה?</h1>
        <p className="mt-2 text-slate-600">מתחילים ממספר הרישוי. המערכת מזהה את הרכב ממאגר משרד התחבורה, ואז משלימה את הנתונים הדרושים לאומדן מכירה וטרייד.</p>
      </div>

      <form onSubmit={lookupPlate} className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold">מספר רישוי</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input inputMode="numeric" className="min-h-12 flex-1 rounded-xl border px-4 text-lg" placeholder="לדוגמה 12345678" value={plate} onChange={e=>setPlate(e.target.value)} />
          <button disabled={lookupLoading || !plate.replace(/\D/g, "")} className="min-h-12 rounded-xl bg-slate-950 px-6 font-bold text-white disabled:opacity-40">{lookupLoading ? "בודק..." : "זהה את הרכב"}</button>
        </div>
        {lookupError && <p className="mt-3 text-sm text-red-600">{lookupError}</p>}
        {vehicle && <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="font-black">{vehicle.year || ""} {vehicle.make || ""} {vehicle.model || ""} {vehicle.trim || ""}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {vehicle.color && <span>צבע: {vehicle.color}</span>}
            {vehicle.fuel_type_raw && <span>דלק: {vehicle.fuel_type_raw}</span>}
            {vehicle.ownership_raw && <span>בעלות במאגר: {vehicle.ownership_raw}</span>}
            {vehicle.first_registration_date && <span>עלייה לכביש: {vehicle.first_registration_date}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">מקור פרטי הזיהוי: מאגר הרכב הפתוח של משרד התחבורה.</p>
        </div>}
      </form>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black">השלמת נתוני שווי</h2>
            <p className="mt-1 text-sm text-slate-500">משרד התחבורה מזהה את הרכב, אך אינו מספק מחיר שוק. עד לחיבור מחירון מורשה, מחיר ההשוואה משמש עוגן זמני.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>מחיר השוואה / מחיר מבוקש<input className="mt-1 w-full rounded-xl border p-3" type="number" min="0" value={price} onChange={e=>setPrice(Number(e.target.value))}/></label>
            <label>שנת מודל<input className="mt-1 w-full rounded-xl border p-3" type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
            <label>קילומטראז׳<input className="mt-1 w-full rounded-xl border p-3" type="number" min="0" value={mileage} onChange={e=>setMileage(Number(e.target.value))}/></label>
            <label>יד<input className="mt-1 w-full rounded-xl border p-3" type="number" min="1" value={hand} onChange={e=>setHand(Number(e.target.value))}/></label>
            <label>בעלות<select className="mt-1 w-full rounded-xl border p-3" value={ownership} onChange={e=>setOwnership(e.target.value as typeof ownership)}><option value="private">פרטית</option><option value="leasing">ליסינג</option><option value="rental">השכרה</option><option value="commercial">מסחרית / חברה</option></select></label>
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
          <div className="mt-4 rounded-2xl border border-white/15 p-4">
            <p className="font-bold">השלב הבא: Trade Match</p>
            <p className="mt-2 text-sm text-slate-300">לאחר חיבור מחיר בסיס מורשה, נציג כאן רכבים מהמלאי של לקוחות ומגרשים ואת ההפרש הכספי לכל החלפה.</p>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-400">האומדן אינו שמאות ואינו מחירון רשמי. מחיר בסיס ממקור מורשה ונתוני השוואה יתווספו לפני השקה מסחרית של שירות התמחור.</p>
        </section>}
      </div>
    </div>
  </main>;
}

function Box({title,value}:{title:string;value:string}) { return <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">{title}</p><p className="mt-2 font-bold">{value}</p></div>; }
