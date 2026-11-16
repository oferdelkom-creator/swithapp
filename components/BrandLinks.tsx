import type { Locale } from "@/lib/i18n/translations";

const labels = {
  he: ["מכירות ותמיכה", "פתרונות לעסקים", "עקבו בפייסבוק"],
  en: ["Sales & support", "Business solutions", "Follow on Facebook"],
  ru: ["Продажи и поддержка", "Для бизнеса", "Мы в Facebook"],
  ar: ["المبيعات والدعم", "حلول للأعمال", "تابعونا على فيسبوك"],
};

export default function BrandLinks({ locale }: { locale: Locale }) {
  const text = labels[locale];
  const links = [
    ["https://wa.me/972533005562", text[0]],
    ["https://business.switchapp.co.il", text[1]],
    ["https://www.facebook.com/profile.php?id=61593678334156", text[2]],
  ];
  return (
    <footer className="border-t border-neutral-200 bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 font-bold">SwitchApp <span dir="ltr" className="ms-2 text-sm font-normal text-neutral-300">052-318-1877</span></p>
        <div lang="he" dir="rtl" className="mb-4 space-y-2 text-sm text-neutral-200"><p>דלקום ע י קום בע״מ · ח.פ 515917516 · לוי אשכול 80, תל אביב</p><p><a href="mailto:info@switchapp.co.il" className="underline">info@switchapp.co.il</a> · <a href="tel:+972523181877" className="underline" dir="ltr">052-318-1877</a></p><nav aria-label="מידע משפטי" className="flex flex-wrap gap-x-5 gap-y-3">{[["/terms","תנאי שימוש"],["/business/terms","הסכם מנוי לעסקים"],["/privacy","מדיניות פרטיות"],["/accessibility","הצהרת נגישות"]].map(([href,label])=><a key={href} href={href} className="underline underline-offset-4">{label}</a>)}</nav></div>
        <nav aria-label="SwitchApp" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          {links.map(([href, label]) => <a key={href} href={href} className="underline underline-offset-4 hover:text-amber-300">{label}</a>)}
        </nav>
      </div>
    </footer>
  );
}
