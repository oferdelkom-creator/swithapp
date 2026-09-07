import type { Locale } from "@/lib/i18n/translations";

const labels = {
  he: ["מכירות ותמיכה", "פתרונות לעסקים", "מגרש הדגמה", "הדגמה עם יוסף", "עקבו בפייסבוק"],
  en: ["Sales & support", "Business solutions", "Demo showroom", "Demo with Yosef", "Follow on Facebook"],
  ru: ["Продажи и поддержка", "Для бизнеса", "Демо-автосалон", "Демонстрация с Йосефом", "Мы в Facebook"],
  ar: ["المبيعات والدعم", "حلول للأعمال", "معرض تجريبي", "عرض مع يوسف", "تابعونا على فيسبوك"],
};

export default function BrandLinks({ locale }: { locale: Locale }) {
  const text = labels[locale];
  const links = [
    ["https://wa.me/972533005562", text[0]],
    ["https://business.switchapp.co.il", text[1]],
    ["https://www.switchapp.co.il/d/yossi-malka", text[2]],
    ["https://www.switchapp.co.il/agent/yossi-malka", text[3]],
    ["https://www.facebook.com/profile.php?id=61593678334156", text[4]],
  ];
  return (
    <footer className="border-t border-neutral-200 bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 font-bold">SwitchApp <span dir="ltr" className="ms-2 text-sm font-normal text-neutral-300">053-300-5562</span></p>
        <nav aria-label="SwitchApp" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          {links.map(([href, label]) => <a key={href} href={href} className="underline underline-offset-4 hover:text-amber-300">{label}</a>)}
        </nav>
      </div>
    </footer>
  );
}
