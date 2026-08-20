"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n/translations";

const copy: Record<
  Locale,
  {
    intro: string;
    headline: string[];
    body: string[];
    cta: string;
    badge: string;
    alt: string;
    importerHeadline: string;
    importerBody: string;
    importerCta: string;
  }
> = {
  he: {
    intro: "המגרש עדיין פתוח להזדמנויות — הצטרפו עכשיו והיו בין הראשונים שמציגים כאן רכבים.",
    headline: [
      "המגרש שלך ראוי ליותר חשיפה",
      "הלקוחות הבאים שלך כבר בדרך",
      "הופכים מלאי רכבים להזדמנויות",
      "אתר עצמאי למגרש שלך",
      "מעלים רכבים. מקבלים פניות.",
      "הגיע הזמן למכור חכם יותר",
      "כל הרכבים שלך במקום אחד",
      "מצטרפים לשוק הרכב החדש",
      "הנוכחות הדיגיטלית שלך מתחילה כאן",
      "פותחים דלת לעסקאות חדשות",
    ],
    body: [
      "הרשמה מהירה, חודש התנסות חינם וללא צורך בכרטיס אשראי.",
      "קבלו עמוד עסקי, העלאת מלאי ופניות מלקוחות במקום אחד.",
      "הציגו את הרכבים שלכם לקונים ולסוחרים שמחפשים בדיוק עכשיו.",
      "חברו דומיין קיים או קבלו כתובת מקצועית לעסק שלכם.",
      "התחילו מ־10 רכבים ובנו נוכחות שמוכרת גם כשהמגרש סגור.",
    ],
    cta: "פותחים מגרש דיגיטלי",
    badge: "מקום פנוי בלוח",
    alt: "מגרש רכבים מקצועי ב-SwitchApp",
    importerHeadline: "יבואן? מקומך פה",
    importerBody: "הציגו את המותג, הדגמים והמבצעים שלכם מול קהל שמגיע כדי למצוא את הרכב הבא.",
    importerCta: "רישום יבואן",
  },
  ar: {
    intro: "السوق مفتوح للفرص — انضم الآن وكن من أوائل التجار الذين يعرضون سياراتهم هنا.",
    headline: [
      "معرضك يستحق انتشارًا أكبر",
      "عملاؤك القادمون في الطريق",
      "حوّل مخزون السيارات إلى فرص",
      "موقع مستقل لمعرضك",
      "ارفع السيارات واستقبل الطلبات",
      "حان وقت البيع بذكاء",
      "كل سياراتك في مكان واحد",
      "انضم إلى سوق السيارات الجديد",
      "حضورك الرقمي يبدأ من هنا",
      "افتح الباب لصفقات جديدة",
    ],
    body: [
      "تسجيل سريع، شهر تجريبي مجاني ومن دون بطاقة ائتمان.",
      "صفحة تجارية وإدارة مخزون وطلبات العملاء في مكان واحد.",
      "اعرض سياراتك أمام مشترين وتجار يبحثون عنها الآن.",
      "اربط نطاقك الحالي أو احصل على عنوان مهني لمعرضك.",
      "ابدأ من 10 سيارات وابنِ حضورًا يبيع حتى بعد إغلاق المعرض.",
    ],
    cta: "افتح معرضك الرقمي",
    badge: "مكان متاح في السوق",
    alt: "معرض سيارات احترافي على SwitchApp",
    importerHeadline: "مستورد سيارات؟ مكانك هنا",
    importerBody: "اعرض علامتك وطرازاتك وعروضك أمام جمهور يبحث الآن عن سيارته القادمة.",
    importerCta: "تسجيل مستورد",
  },
  en: {
    intro: "The marketplace is open for opportunity — join now and be among the first dealers featured here.",
    headline: [
      "Your dealership deserves more reach",
      "Your next customers are on the way",
      "Turn vehicle stock into opportunity",
      "A standalone site for your dealership",
      "Upload cars. Receive leads.",
      "It is time to sell smarter",
      "All your vehicles in one place",
      "Join the new vehicle marketplace",
      "Your digital presence starts here",
      "Open the door to new deals",
    ],
    body: [
      "Quick registration, one month free, and no credit card required.",
      "Get a business page, inventory tools, and customer leads in one place.",
      "Show your vehicles to buyers and dealers actively looking today.",
      "Connect your existing domain or receive a professional web address.",
      "Start with 10 vehicles and build a presence that works after hours.",
    ],
    cta: "Open your digital dealership",
    badge: "Open marketplace spot",
    alt: "Professional vehicle dealership on SwitchApp",
    importerHeadline: "Vehicle importer? Your place is here",
    importerBody: "Put your brand, models, and offers in front of people actively choosing their next vehicle.",
    importerCta: "Register as an importer",
  },
  ru: {
    intro: "Площадка открыта для новых возможностей — присоединяйтесь одним из первых дилеров.",
    headline: [
      "Ваш автосалон достоин большего охвата",
      "Ваши новые клиенты уже в пути",
      "Превратите склад автомобилей в сделки",
      "Собственный сайт для автосалона",
      "Загружайте авто. Получайте заявки.",
      "Продавайте автомобили эффективнее",
      "Все ваши автомобили в одном месте",
      "Присоединяйтесь к новому авторынку",
      "Ваше онлайн-присутствие начинается здесь",
      "Откройте путь к новым сделкам",
    ],
    body: [
      "Быстрая регистрация, месяц бесплатно и без банковской карты.",
      "Страница бизнеса, управление складом и заявки в одном месте.",
      "Покажите автомобили покупателям и дилерам, которые ищут их сейчас.",
      "Подключите свой домен или получите профессиональный адрес.",
      "Начните с 10 автомобилей и продавайте даже после закрытия салона.",
    ],
    cta: "Открыть цифровой автосалон",
    badge: "Свободное место",
    alt: "Профессиональный автосалон на SwitchApp",
    importerHeadline: "Импортёр? Ваше место здесь",
    importerBody: "Покажите бренд, модели и предложения аудитории, которая выбирает следующий автомобиль.",
    importerCta: "Регистрация импортёра",
  },
};

const images = [
  "/campaign/dealer-night.webp",
  "/campaign/dealer-clean.webp",
  "/campaign/dealer-owner.webp",
  "/campaign/dealer-choice.webp",
];

const overlays = [
  "from-slate-950/95 via-slate-900/45 to-transparent",
  "from-emerald-950/90 via-teal-900/35 to-transparent",
  "from-blue-950/95 via-indigo-900/40 to-transparent",
  "from-rose-950/90 via-orange-900/35 to-transparent",
  "from-violet-950/90 via-fuchsia-900/35 to-transparent",
];

const brands = [
  "Toyota", "Hyundai", "Kia", "Mazda", "Skoda", "Suzuki", "Mitsubishi", "Nissan", "Honda", "Ford",
  "Chevrolet", "Renault", "Peugeot", "Citroen", "Volkswagen", "SEAT", "Cupra", "Opel", "Fiat", "Volvo",
  "BMW", "Mini", "Mercedes-Benz", "Smart", "Audi", "Lexus", "Subaru", "Dacia", "Jeep", "Chrysler",
  "Jaguar", "Land Rover", "Porsche", "Alfa Romeo", "Isuzu", "Genesis", "Cadillac", "Tesla", "Polestar", "BYD",
  "Chery", "MG", "Geely", "Zeekr", "Xpeng", "NIO", "Yamaha", "Kawasaki", "Scania", "Iveco",
];

const logoSlugs: Record<string, string> = {
  Toyota: "toyota", Hyundai: "hyundai", Kia: "kia", Mazda: "mazda", Suzuki: "suzuki", Mitsubishi: "mitsubishi",
  Nissan: "nissan", Honda: "honda", Ford: "ford", Chevrolet: "chevrolet", Renault: "renault", Peugeot: "peugeot",
  Volkswagen: "volkswagen", SEAT: "seat", Opel: "opel", Fiat: "fiat", Volvo: "volvo", BMW: "bmw", Mini: "mini",
  Smart: "smart", Audi: "audi", Subaru: "subaru", Dacia: "dacia", Jeep: "jeep", Chrysler: "chrysler",
  Porsche: "porsche", Cadillac: "cadillac", Tesla: "tesla", Polestar: "polestar", MG: "mg",
  Citroen: "citroen", Yamaha: "yamahamotorcorporation", Scania: "scania", Iveco: "iveco",
};

export default function EmptyCampaignCards() {
  const { locale } = useLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="empty-campaign-title" className="space-y-5">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="empty-campaign-title" className="text-2xl font-black text-neutral-900">
          {text.headline[7]}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{text.intro}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 50 }, (_, index) => {
          const number = index + 1;
          const headline = text.headline[index % text.headline.length];
          const body = text.body[Math.floor(index / text.headline.length)];
          const image = images[index % images.length];
          const overlay = overlays[index % overlays.length];
          const brand = brands[index];
          const logoSlug = logoSlugs[brand];
          const importerCard = number % 5 === 0;

          return (
            <article
              key={number}
              className="group relative isolate min-h-[430px] overflow-hidden rounded-[1.75rem] bg-slate-950 shadow-lg ring-1 ring-black/5 transition duration-300 [content-visibility:auto] [contain-intrinsic-size:430px] hover:-translate-y-1 hover:shadow-2xl"
            >
              <Image
                src={image}
                alt={text.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${overlay}`} />
              <div className="absolute inset-x-0 bottom-0 z-10 flex min-h-[65%] flex-col justify-end p-5 text-white">
                <div className="mb-auto flex items-center justify-between gap-3 text-[11px] font-bold tracking-wide">
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-slate-900 shadow-md">
                    {logoSlug ? (
                      <Image src={`/vehicle-logos/${logoSlug}.svg`} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                    ) : (
                      <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[9px] font-black text-white">
                        {brand.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span>{brand}</span>
                  </span>
                  <span aria-label={`${number} / 50`} className="rounded-full bg-black/30 px-2.5 py-1.5 tabular-nums backdrop-blur-md">
                    {String(number).padStart(2, "0")}/50
                  </span>
                </div>
                <p className="mt-8 text-xs font-black uppercase tracking-wider text-cyan-200">{text.badge}</p>
                <h3 className="mt-2 text-2xl font-black leading-tight drop-shadow-sm">
                  {importerCard ? text.importerHeadline : headline}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/85">{importerCard ? text.importerBody : body}</p>
                <Link
                  href="/business/join/signup"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-md transition hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {importerCard ? text.importerCta : text.cta}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
