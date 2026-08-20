import Image from "next/image";
import Link from "next/link";

const vehicles = [
  { make: "Toyota", model: "Corolla Hybrid", year: 2025, price: "149,900", image: "/campaign/dealer-clean.webp" },
  { make: "Hyundai", model: "Tucson", year: 2025, price: "189,900", image: "/campaign/dealer-owner.webp" },
  { make: "Kia", model: "Niro EV", year: 2024, price: "174,900", image: "/campaign/dealer-night.webp" },
];

export default function DemoShowroom({ type }: { type: "dealer" | "importer" }) {
  const importer = type === "importer";
  const title = importer ? "Switch Motors — יבואן לדוגמה" : "מרכז הרכב Switch — מגרש לדוגמה";
  const subtitle = importer
    ? "עמוד תצוגה ממותג ליבואן, עם דגמים חדשים, לידים ובקשות טרייד־אין במקום אחד."
    : "כך יכול להיראות המגרש הדיגיטלי שלכם: מלאי, פניות וטרייד־אין בעמוד ממותג אחד.";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12" dir="rtl">
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        עמוד הדגמה בלבד — העסק והרכבים המוצגים כאן אינם מודעות פעילות.
      </div>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-brand-blue to-brand-blue-dark px-6 py-10 text-white sm:px-10">
        <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          {importer ? "יבואן רכב" : "מגרש רכב"} · הדגמה
        </span>
        <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-white/80">{subtitle}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/business/join/signup" className="rounded-full bg-white px-6 py-3 font-semibold text-brand-blue">
            פתחו מגרש חינם לחודש
          </Link>
          <a href="#inventory" className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white">
            לצפייה במלאי לדוגמה
          </a>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-3 gap-3 text-center">
        {[["24", "רכבים במלאי"], ["12", "פניות השבוע"], ["5", "בקשות טרייד־אין"]].map(([value, label]) => (
          <div key={label} className="card p-4">
            <p className="text-2xl font-bold text-brand-blue">{value}</p>
            <p className="mt-1 text-xs text-neutral-500">{label}</p>
          </div>
        ))}
      </section>

      <section id="inventory" className="mt-10 scroll-mt-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-sm font-semibold text-brand-pink">מלאי לדוגמה</p><h2 className="text-2xl font-bold">רכבים זמינים</h2></div>
          <span className="text-sm text-neutral-500">החלקה · קנייה · החלפה</span>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <article key={vehicle.model} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-neutral-100">
                <Image src={vehicle.image} alt="תמונת המחשה לרכב לדוגמה" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">הדגמה</span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold">{vehicle.make} {vehicle.model}</h3>
                <p className="mt-1 text-sm text-neutral-500">שנת {vehicle.year} · ₪{vehicle.price}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <button className="rounded-xl bg-neutral-100 px-2 py-2">דלג</button>
                  <button className="rounded-xl bg-amber-100 px-2 py-2 text-amber-800">החלפה</button>
                  <button className="rounded-xl bg-emerald-100 px-2 py-2 text-emerald-800">מעוניין</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-3xl bg-neutral-50 p-7 text-center">
        <h2 className="text-2xl font-bold">המקום שלכם יכול להיראות כך</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600">30 יום חינם, ללא כרטיס אשראי. ההטבה מוגבלת ל־30 הנרשמים הראשונים.</p>
        <Link href="/business/join/signup" className="btn-primary mt-5 inline-flex px-8 py-3">להרשמה לפיילוט</Link>
      </section>
    </main>
  );
}
