import { toWhatsAppLink } from "@/lib/phone";

const ADIR_PHONE = "+972504747404";
const ADIR_EMAIL = "adir55599@gmail.com";
const VEHICLE_SLOTS = [
  { plate: "570-89-002", make: "MG", model: "MG4", year: 2023, trim: "COMFORT", fuel: "חשמלי", color: "שנהב לבן", hand: 1, ownership: "החכרה", photo: "/dealers/adir/57089002-2.jpeg", photoCount: 2 },
  { plate: "364-34-903", make: "BYD", model: "ATTO 3", year: 2023, trim: "DESIGN", fuel: "חשמלי", color: "שנהב לבן", hand: 1, ownership: "החכרה", photo: "/dealers/adir/36434903-1.jpeg", photoCount: 3 },
  { plate: "641-29-602", make: "Skoda", model: "SCALA", year: 2022, trim: "AMBITION", fuel: "בנזין", color: "שנהב לבן", hand: 1, ownership: "החכרה", photo: "/dealers/adir/64129602-1.jpeg", photoCount: 2 },
  { plate: "170-49-303", make: "Kia", model: "SELTOS", year: 2022, trim: "EX PLUS", fuel: "בנזין", color: "שנהב לבן", hand: 2, ownership: "החכרה בעבר", photo: "/dealers/adir/17049303-1.jpeg", photoCount: 2 },
  { plate: "174-34-303", make: "Kia", model: "SPORTAGE", year: 2022, trim: "URBAN", fuel: "בנזין", color: "אפור כהה", hand: 2, ownership: "החכרה בעבר", photo: "/dealers/adir/17434303-1.jpeg", photoCount: 2 },
];

export default function AdirDealerDraft() {
  const whatsapp = `${toWhatsAppLink(ADIR_PHONE)}?text=${encodeURIComponent(
    "שלום אדיר, הגעתי אליך דרך עולם של רכבים ב־SwitchAuto AI"
  )}`;

  return (
    <main className="min-h-screen bg-[#07111f] pb-28 text-white" dir="rtl">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(29,78,216,.48),transparent_42%),radial-gradient(circle_at_90%_85%,rgba(6,182,212,.22),transparent_38%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-12 md:py-16">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="mb-3 text-sm font-bold tracking-wide text-cyan-300">עמוד עסקי ב־SwitchAuto AI</p>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">עולם של רכבים</h1>
              <p className="mt-3 text-lg text-slate-300">אדיר · מכירה והחלפת רכבים</p>
            </div>
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/30 bg-white shadow-2xl shadow-blue-900/40 md:h-24 md:w-36">
              <img src="/dealers/adir/logo.jpeg" alt="ADIR Trade In" className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#25D366] px-6 text-base font-bold text-white transition hover:bg-[#1fb855]"
            >
              שלחו הודעה בוואטסאפ
            </a>
            <a
              href={`tel:${ADIR_PHONE}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-base font-bold text-white transition hover:bg-white/15"
            >
              חייגו לאדיר
            </a>
            <a
              href={`mailto:${ADIR_EMAIL}?subject=${encodeURIComponent("פנייה דרך ADIR Trade In")}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-base font-bold text-white transition hover:bg-white/15"
            >
              שלחו מייל
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-300">המלאי של אדיר</p>
            <h2 className="mt-1 text-2xl font-black md:text-3xl">5 רכבים יוצגו כאן</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">בהכנה</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {VEHICLE_SLOTS.map((vehicle, index) => (
            <article key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/15">
              <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950">
                {vehicle.photo ? (
                  <>
                    <img src={vehicle.photo} alt={`רכב ${vehicle.plate}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                      {vehicle.photoCount} תמונות
                    </span>
                  </>
                ) : (
                  <div className="text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-lg font-black text-cyan-300">
                      {index + 1}
                    </span>
                    <p className="mt-3 text-sm font-medium text-slate-400">תמונת הרכב תעלה בקרוב</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-lg font-bold text-white">
                  {vehicle.model ? `${vehicle.make} ${vehicle.model}` : "פרטי הרכב בהכנה"}
                </p>
                {vehicle.plate ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-cyan-300">
                      <bdi dir="ltr">{vehicle.plate}</bdi>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {vehicle.year} · {vehicle.trim} · {vehicle.fuel}
                    </p>
                    <p className="text-sm leading-6 text-slate-400">יד {vehicle.hand} · {vehicle.ownership} · צבע: {vehicle.color}</p>
                    <p className="text-sm leading-6 text-slate-400">המחיר יעודכן</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-slate-400">דגם, שנה, קילומטראז׳ ומחיר</p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-5 md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold">מחפשים רכב מסוים?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-300">כתבו לאדיר מה אתם מחפשים והוא יחזור אליכם עם אפשרויות מתאימות.</p>
          </div>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#07111f] md:mt-0">
            דברו עם אדיר
          </a>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07111f]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur md:hidden">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mx-auto flex min-h-12 max-w-md items-center justify-center rounded-full bg-[#25D366] px-6 font-bold text-white">
          שלחו הודעה לאדיר
        </a>
      </div>
    </main>
  );
}
