"use client";

import { useState } from "react";
import { toWhatsAppLink } from "@/lib/phone";

const ADIR_PHONE = "+972504747404";
const ADIR_EMAIL = "adir55599@gmail.com";

export type AdirVehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  fuel: string;
  color: string;
  hand: number;
  ownership: string;
  price: number;
  photos: string[];
};

function whatsappFor(vehicle?: AdirVehicle, intent?: "buy" | "trade") {
  const message = vehicle
    ? intent === "trade"
      ? `שלום אדיר, הגעתי דרך SwitchAuto AI ואני רוצה להציע רכב בהחלפה עבור ${vehicle.make} ${vehicle.model}, מספר רכב ${vehicle.plate}`
      : `שלום אדיר, הגעתי דרך SwitchAuto AI ואני מעוניין ב־${vehicle.make} ${vehicle.model}, מספר רכב ${vehicle.plate}`
    : "שלום אדיר, הגעתי אליך דרך עולם של רכבים ב־SwitchAuto AI";
  return `${toWhatsAppLink(ADIR_PHONE)}?text=${encodeURIComponent(message)}`;
}

export default function AdirDealerDraft({ vehicles }: { vehicles: AdirVehicle[] }) {
  const [view, setView] = useState<"swap" | "catalog">("swap");

  return (
    <main className="min-h-screen bg-[#07111f] pb-28 text-white" dir="rtl">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(29,78,216,.48),transparent_42%),radial-gradient(circle_at_90%_85%,rgba(6,182,212,.22),transparent_38%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-8 md:py-14">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="mb-2 text-sm font-bold text-cyan-300">המגרש של אדיר</p>
              <h1 className="text-3xl font-black tracking-tight md:text-6xl">עולם של רכבים</h1>
              <p className="mt-2 text-base text-slate-300 md:text-lg">מכירה · החלפה · טרייד־אין</p>
            </div>
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/30 bg-white shadow-2xl shadow-blue-900/40 md:h-24 md:w-36">
              <img src="/dealers/adir/logo.jpeg" alt="ADIR Trade In" className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href={whatsappFor()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#25D366] px-6 text-base font-bold text-white transition hover:bg-[#1fb855]">WhatsApp לאדיר</a>
            <a href={`tel:${ADIR_PHONE}`} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-base font-bold text-white">חייגו לאדיר</a>
            <a href={`mailto:${ADIR_EMAIL}?subject=${encodeURIComponent("פנייה דרך ADIR Trade In")}`} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-base font-bold text-white">שלחו מייל</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-7 md:py-10">
        <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/[0.05] p-1.5" role="tablist" aria-label="אופן הצגת המלאי">
          <button type="button" role="tab" aria-selected={view === "swap"} onClick={() => setView("swap")} className={`min-h-12 flex-1 rounded-xl px-4 text-sm font-bold transition ${view === "swap" ? "bg-cyan-400 text-[#07111f]" : "text-slate-300"}`}>החלפה מהירה</button>
          <button type="button" role="tab" aria-selected={view === "catalog"} onClick={() => setView("catalog")} className={`min-h-12 flex-1 rounded-xl px-4 text-sm font-bold transition ${view === "catalog" ? "bg-cyan-400 text-[#07111f]" : "text-slate-300"}`}>כל המלאי ({vehicles.length})</button>
        </div>

        {view === "swap" ? <SwapDeck vehicles={vehicles} /> : <Catalog vehicles={vehicles} />}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07111f]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur md:hidden">
        <a href={whatsappFor()} target="_blank" rel="noopener noreferrer" className="mx-auto flex min-h-12 max-w-md items-center justify-center rounded-full bg-[#25D366] px-6 font-bold text-white">שלחו הודעה לאדיר</a>
      </div>
    </main>
  );
}

function SwapDeck({ vehicles }: { vehicles: AdirVehicle[] }) {
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const vehicle = vehicles[vehicleIndex];

  if (!vehicle) return <p className="text-center text-slate-400">אין כרגע רכבים זמינים.</p>;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-300">בחרו מה מתאים לכם</p>
          <h2 className="mt-1 text-2xl font-black">לקנייה או להחלפה</h2>
        </div>
        <span className="text-sm text-slate-400">{vehicleIndex + 1} / {vehicles.length}</span>
      </div>

      <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25">
        <VehicleGallery vehicle={vehicle} />
        <VehicleDetails vehicle={vehicle} />
      </article>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <button type="button" onClick={() => setVehicleIndex((vehicleIndex + 1) % vehicles.length)} className="min-h-14 rounded-2xl border border-white/15 bg-white/10 px-2 font-bold text-slate-200">דלגו</button>
        <a href={whatsappFor(vehicle, "trade")} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl bg-amber-500 px-2 text-center font-black text-[#07111f]">הציעו החלפה</a>
        <a href={whatsappFor(vehicle, "buy")} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl bg-[#25D366] px-2 text-center font-black text-white">מעוניין לקנות</a>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-slate-400">לחצו על החצים או הנקודות כדי לראות את כל התמונות</p>
    </div>
  );
}

function Catalog({ vehicles }: { vehicles: AdirVehicle[] }) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold text-cyan-300">המלאי של אדיר</p>
        <h2 className="mt-1 text-2xl font-black md:text-3xl">{vehicles.length} רכבים זמינים</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/15">
            <VehicleGallery vehicle={vehicle} />
            <VehicleDetails vehicle={vehicle} />
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <a href={whatsappFor(vehicle, "trade")} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-3 text-sm font-black text-[#07111f]">החלפה</a>
              <a href={whatsappFor(vehicle, "buy")} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-[#25D366] px-3 text-sm font-black text-white">קנייה</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function VehicleGallery({ vehicle }: { vehicle: AdirVehicle }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const previous = () => setPhotoIndex((photoIndex - 1 + vehicle.photos.length) % vehicle.photos.length);
  const next = () => setPhotoIndex((photoIndex + 1) % vehicle.photos.length);

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
      {vehicle.photos.map((photo, index) => (
        <img key={photo} src={photo} alt={`${vehicle.make} ${vehicle.model} — תמונה ${index + 1}`} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${index === photoIndex ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      ))}
      <button type="button" onClick={previous} aria-label="לתמונה הקודמת" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl text-white backdrop-blur">‹</button>
      <button type="button" onClick={next} aria-label="לתמונה הבאה" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl text-white backdrop-blur">›</button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {vehicle.photos.map((_, index) => (
          <button key={index} type="button" onClick={() => setPhotoIndex(index)} aria-label={`הצגת תמונה ${index + 1}`} className={`h-2 rounded-full transition-all ${index === photoIndex ? "w-7 bg-cyan-300" : "w-2 bg-white/60"}`} />
        ))}
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{photoIndex + 1} / {vehicle.photos.length}</span>
    </div>
  );
}

function VehicleDetails({ vehicle }: { vehicle: AdirVehicle }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-black text-white">{vehicle.make} {vehicle.model}</p>
        <p className="shrink-0 text-sm font-bold text-cyan-300"><bdi dir="ltr">{vehicle.plate}</bdi></p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{vehicle.year} · {vehicle.trim} · {vehicle.fuel}</p>
      <p className="text-sm leading-6 text-slate-400">יד {vehicle.hand} · {vehicle.ownership} · צבע: {vehicle.color}</p>
      <p className="mt-1 text-lg font-black text-white"><bdi dir="ltr">₪{vehicle.price.toLocaleString("he-IL")}</bdi></p>
    </div>
  );
}
