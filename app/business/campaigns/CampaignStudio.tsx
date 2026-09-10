"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CampaignVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  price: number | null;
  photo_urls: string[];
}

export interface CampaignDraft {
  id: string;
  car_id: string | null;
  platform: "meta" | "facebook" | "instagram";
  objective: "leads" | "messages" | "traffic";
  status: "draft" | "ready" | "active" | "paused" | "completed" | "failed";
  headline: string;
  primary_text: string;
  daily_budget: number | null;
  target_region: string | null;
  destination_url: string | null;
  created_at: string;
}

function defaultCopy(car: CampaignVehicle, businessName: string) {
  const year = car.year ? ` ${car.year}` : "";
  const price = car.price ? ` במחיר ₪${Number(car.price).toLocaleString("he-IL")}` : "";
  return {
    headline: `${car.make} ${car.model}${year} — זמינה עכשיו`,
    primaryText: `${car.make} ${car.model}${year}${price}. אפשרות לקנייה או להצעת טרייד־אין. שלחו הודעה ל־${businessName} וקבלו פרטים נוספים.`,
  };
}

export default function CampaignStudio({ userId, businessName, cars, initialCampaigns }: {
  userId: string;
  businessName: string;
  cars: CampaignVehicle[];
  initialCampaigns: CampaignDraft[];
}) {
  const firstCar = cars[0] ?? null;
  const initialCopy = firstCar ? defaultCopy(firstCar, businessName) : { headline: "", primaryText: "" };
  const [selectedCarId, setSelectedCarId] = useState(firstCar?.id ?? "");
  const [platform, setPlatform] = useState<CampaignDraft["platform"]>("meta");
  const [objective, setObjective] = useState<CampaignDraft["objective"]>("messages");
  const [headline, setHeadline] = useState(initialCopy.headline);
  const [primaryText, setPrimaryText] = useState(initialCopy.primaryText);
  const [dailyBudget, setDailyBudget] = useState("50");
  const [targetRegion, setTargetRegion] = useState("עד 30 ק״מ מהמגרש");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedCar = useMemo(() => cars.find((car) => car.id === selectedCarId) ?? null, [cars, selectedCarId]);

  function chooseCar(carId: string) {
    setSelectedCarId(carId);
    const car = cars.find((candidate) => candidate.id === carId);
    if (car) {
      const copy = defaultCopy(car, businessName);
      setHeadline(copy.headline);
      setPrimaryText(copy.primaryText);
    }
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCar) return;
    setSaving(true);
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dealer_campaigns")
      .insert({
        user_id: userId,
        car_id: selectedCar.id,
        platform,
        objective,
        status: "draft",
        headline: headline.trim(),
        primary_text: primaryText.trim(),
        daily_budget: dailyBudget ? Number(dailyBudget) : null,
        target_region: targetRegion.trim() || null,
        destination_url: `https://www.switchapp.co.il/cars/${selectedCar.id}`,
      })
      .select("id, car_id, platform, objective, status, headline, primary_text, daily_budget, target_region, destination_url, created_at")
      .single<CampaignDraft>();
    setSaving(false);
    if (error || !data) {
      setNotice("לא הצלחנו לשמור את הטיוטה. נסו שוב.");
      return;
    }
    setCampaigns((current) => [data, ...current]);
    setNotice("הטיוטה נשמרה. לאחר חיבור Meta יהיה אפשר לשלוח אותה לאישור ולפרסום.");
  }

  if (!cars.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12" dir="rtl">
        <Link href="/business" className="text-sm font-medium text-brand-blue">חזרה לפאנל</Link>
        <div className="card mt-6 p-8 text-center">
          <h1 className="text-2xl font-bold">שיווק וקמפיינים</h1>
          <p className="mt-3 text-neutral-600">כדי להכין מודעה צריך קודם להוסיף לפחות רכב אחד למלאי.</p>
          <Link href="/cars" className="btn-primary mt-6 inline-flex">הוספת רכב</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12" dir="rtl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/business" className="text-sm font-medium text-brand-blue">חזרה לפאנל</Link>
          <h1 className="mt-2 text-3xl font-black">שיווק וקמפיינים</h1>
          <p className="mt-2 text-neutral-600">הכינו מודעה מהמלאי ושמרו אותה לקראת פרסום בפייסבוק ובאינסטגרם.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">חיבור Meta נמצא בהכנה · שמירת טיוטות פעילה</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.86fr]">
        <form onSubmit={saveDraft} className="card space-y-5 p-5 md:p-7">
          <Field label="בחרו רכב מהמלאי">
            <select value={selectedCarId} onChange={(event) => chooseCar(event.target.value)} className="field w-full">
              {cars.map((car) => <option key={car.id} value={car.id}>{car.make} {car.model} {car.year ?? ""}</option>)}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ערוץ פרסום">
              <select value={platform} onChange={(event) => setPlatform(event.target.value as CampaignDraft["platform"])} className="field w-full">
                <option value="meta">Facebook + Instagram</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option>
              </select>
            </Field>
            <Field label="מטרת הקמפיין">
              <select value={objective} onChange={(event) => setObjective(event.target.value as CampaignDraft["objective"])} className="field w-full">
                <option value="messages">הודעות ו־WhatsApp</option><option value="leads">איסוף לידים</option><option value="traffic">כניסות לדף הרכב</option>
              </select>
            </Field>
          </div>

          <Field label="כותרת">
            <input required maxLength={80} value={headline} onChange={(event) => setHeadline(event.target.value)} className="field w-full" />
            <p className="mt-1 text-xs text-neutral-500">{headline.length}/80</p>
          </Field>
          <Field label="טקסט המודעה">
            <textarea required rows={5} maxLength={500} value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} className="field w-full resize-y" />
            <p className="mt-1 text-xs text-neutral-500">{primaryText.length}/500</p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-neutral-600">תקציב הפרסום לבחירתכם. דמי ניהול של 20% נוספים להוצאה בפועל. כל המחירים כוללים מע״מ.</p>
            <Field label="תקציב מדיה יומי משוער (ללא דמי ניהול)">
              <div className="relative"><span className="absolute inset-y-0 right-3 flex items-center text-neutral-500">₪</span><input required min="20" step="10" type="number" value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} className="field w-full pr-8" /></div>
            </Field>
            <Field label="אזור פרסום"><input value={targetRegion} onChange={(event) => setTargetRegion(event.target.value)} className="field w-full" /></Field>
          </div>

          {notice && <p className="rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{notice}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "שומרים…" : "שמירת טיוטת קמפיין"}</button>
        </form>

        <section>
          <h2 className="mb-3 font-bold">תצוגה מקדימה</h2>
          <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center gap-3 p-4"><div className="grid h-10 w-10 place-items-center rounded-full bg-brand-blue text-sm font-black text-white">{businessName.charAt(0)}</div><div><p className="font-semibold">{businessName}</p><p className="text-xs text-neutral-500">ממומן · Facebook & Instagram</p></div></div>
            {selectedCar?.photo_urls?.[0] ? <img src={selectedCar.photo_urls[0]} alt="" className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-neutral-100" />}
            <div className="space-y-2 p-4">
              <p className="text-sm leading-6 text-neutral-700">{primaryText}</p>
              <div className="flex items-center justify-between gap-3 border-t pt-3"><div><p className="font-bold">{headline}</p><p className="text-xs text-neutral-500">switchapp.co.il</p></div><span className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold">שליחת הודעה</span></div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">טיוטות שנשמרו</h2><span className="text-sm text-neutral-500">{campaigns.length} טיוטות</span></div>
        {campaigns.length ? <div className="grid gap-3 md:grid-cols-2">{campaigns.map((campaign) => <article key={campaign.id} className="card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{campaign.headline}</p><p className="mt-1 line-clamp-2 text-sm text-neutral-500">{campaign.primary_text}</p></div><span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium">טיוטה</span></div><p className="mt-3 text-xs text-neutral-500">{campaign.platform === "meta" ? "Facebook + Instagram" : campaign.platform} · ₪{campaign.daily_budget ?? 0} ליום · {campaign.target_region ?? "ללא אזור"}</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">עדיין לא נשמרו טיוטות.</div>}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-sm font-semibold">{label}</label>{children}</div>;
}
