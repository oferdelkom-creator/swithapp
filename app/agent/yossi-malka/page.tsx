import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "יוסף מלכא | SwitchAuto AI",
  description: "יוסף מלכא — נציג שטח SwitchAuto AI למגרשים, סוחרי רכב ויבואנים.",
};

const phone = "+972536555774";
const whatsapp = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent("שלום יוסף, הגעתי דרך SwitchAuto AI ואני מעוניין לשמוע על הצטרפות לפיילוט למגרשי רכב.")}`;

export default function YossiMalkaAgentPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl sm:p-10">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-black text-neutral-950">YM</div>
            <div>
              <p className="mb-1 text-sm font-semibold tracking-wide text-red-400">SWITCHAUTO AI</p>
              <h1 className="text-3xl font-black">יוסף מלכא</h1>
              <p className="mt-1 text-neutral-300">נציג שטח למגרשים, סוחרים ויבואני רכב</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5">
            <h2 className="text-xl font-bold">יותר הזדמנויות מהמלאי שכבר יש לך</h2>
            <p className="mt-3 leading-7 text-neutral-300">
              SwitchAuto AI מחברת את מלאי הרכב של העסק לעולם של קנייה, מכירה ו-Trade. יוסף מלווה מגרשים וסוחרים בתהליך ההיכרות וההצטרפות לפיילוט.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["BUY", "לקוחות שמחפשים לקנות"],
              ["SELL", "חשיפה נוספת למלאי"],
              ["TRADE", "התאמות לעסקאות החלפה"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 p-4">
                <p className="font-black text-red-400">{title}</p>
                <p className="mt-1 text-sm text-neutral-300">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-bold">רוצים להצטרף לפיילוט?</p>
            <p className="mt-1 text-sm text-neutral-300">דברו ישירות עם יוסף והוא יציג לכם את המערכת ואת מסלול ההצטרפות.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-5 py-3 text-center font-bold text-white">WhatsApp ליוסף</a>
            <a href={`tel:${phone}`} className="rounded-full border border-white/20 px-5 py-3 text-center font-bold">התקשרו ליוסף</a>
          </div>

          <div className="mt-6 text-center text-sm text-neutral-400">
            <a href="mailto:YMALKA630@gmail.com" className="hover:text-white">YMALKA630@gmail.com</a>
            <span className="mx-2">•</span>
            <span>053-655-5774</span>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-semibold">
            <a href="https://switchapp.co.il" className="hover:text-red-400">SwitchApp ללקוחות</a>
            <a href="https://business.switchapp.co.il" className="hover:text-red-400">SwitchAuto AI לעסקים</a>
          </div>
        </div>
      </section>
    </main>
  );
}
