import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "יוסף מלכה | SwitchApp",
  description: "יוסף מלכה — הדגמה והצטרפות ל-SwitchApp למגרשים, סוחרי רכב ויבואנים.",
};

const phone = "+972536555774";
const whatsapp = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent("שלום יוסף, הגעתי דרך SwitchApp ואני מעוניין בהדגמה של המערכת לעסק שלי.")}`;

export default function YossiMalkaAgentPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl sm:p-10">
          <div className="mb-8 flex items-center gap-4">
            <Image src="/yossi-malka-profile.webp" alt="יוסף מלכה — SwitchApp" width={96} height={96} className="h-24 w-24 shrink-0 rounded-2xl" />
            <div>
              <p className="mb-1 text-sm font-semibold tracking-wide text-red-400">SWITCHAPP</p>
              <h1 className="text-3xl font-black">יוסף מלכה</h1>
              <p className="mt-1 text-neutral-300">נציג שטח למגרשים, סוחרים ויבואני רכב</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5">
            <h2 className="text-xl font-bold">יותר הזדמנויות מהמלאי שכבר יש לך</h2>
            <p className="mt-3 leading-7 text-neutral-300">
              SwitchApp מחברת את מלאי הרכב של העסק לעולם של קנייה, מכירה וטרייד־אין. יוסף מלווה מגרשים וסוחרים בהדגמת המערכת ובהתאמת מסלול ההצטרפות לעסק.
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
            <p className="font-bold">רוצים לראות איך זה עובד בעסק שלכם?</p>
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
            <a href="https://business.switchapp.co.il" className="hover:text-red-400">SwitchApp לעסקים</a>
            <a href="https://www.switchapp.co.il/d/yossi-malka" className="hover:text-red-400">מגרש ההדגמה של יוסף</a>
            <a href="https://wa.me/972533005562" className="hover:text-red-400">מכירות ותמיכה — SwitchApp</a>
          </div>
        </div>
      </section>
    </main>
  );
}
