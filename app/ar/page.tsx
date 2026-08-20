import Link from "next/link";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const title = "SwitchApp بالعربية | بيع وشراء وتبديل السيارات في إسرائيل";
const description = "منصة عربية لبيع وشراء وتبديل السيارات، مع سوق خاص لتجار ومعارض السيارات وإدارة المخزون والصفقات.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${SITE_URL}/ar`,
    languages: { ar: `${SITE_URL}/ar`, "x-default": SITE_URL },
  },
  openGraph: { title, description, url: `${SITE_URL}/ar`, locale: "ar_IL", type: "website" },
};

export default function ArabicLandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: `${SITE_URL}/ar`,
    inLanguage: "ar",
    applicationCategory: "AutomotiveBusiness",
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "ILS", description: "تسجيل مجاني وتجربة مجانية لأول 30 تاجراً" },
  };

  return (
    <main lang="ar" dir="rtl" className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
        <p className="mx-auto mb-4 w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-brand-blue">سوق السيارات الذكي في إسرائيل</p>
        <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight text-brand-blue-dark sm:text-6xl">بيع، اشترِ أو بدّل سيارتك بسهولة مع SwitchApp</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">تصفّح سيارات للبيع والتبديل، اعثر على العرض المناسب وتواصل مباشرة. تجربة عربية واضحة للأفراد وتجار السيارات.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/swipe" className="btn-primary px-7 py-3 text-base">تصفّح السيارات</Link>
          <Link href="/business/join" className="btn-secondary px-7 py-3 text-base">سجّل كتاجر سيارات</Link>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
          {[
            ["بيع وشراء السيارات", "اعرض سيارتك أو ابحث عن سيارة تناسب احتياجاتك وميزانيتك."],
            ["تبديل وفرق سعر", "اقترح سيارتك للتبديل واتفق مع الطرف الآخر على فرق السعر."],
            ["حل متكامل للمعارض", "متجر رقمي، إدارة مخزون وسوق للتعامل مع تجار ومعارض أخرى."],
          ].map(([heading, body]) => (
            <article key={heading} className="card p-6 text-right">
              <h2 className="text-xl font-bold text-brand-blue-dark">{heading}</h2>
              <p className="mt-3 leading-7 text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-brand-blue-dark">لأصحاب معارض وتجارة السيارات</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-muted">ارفع مخزون السيارات من Excel، شارك متجرك بعنوان خاص، وشاهد سيارات التجار الآخرين للشراء أو التبديل. التسجيل يبدأ من 10 سيارات.</p>
        <p className="mt-5 font-semibold text-emerald-700">شهر كامل مجاناً لأول 30 تاجراً، من دون بطاقة ائتمان.</p>
        <Link href="/business/join" className="btn-primary mt-7 inline-flex px-8 py-3">ابدأ التسجيل المجاني</Link>
      </section>
    </main>
  );
}
