import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export function generateMetadata(): Metadata {
  return { alternates: { canonical: SITE_URL }, openGraph: { url: SITE_URL } };
}

export default async function HomePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const { count } = await supabase.from("cars").select("id", { count: "exact", head: true });
  const { data: featuredCar } = await supabase
    .from("cars")
    .select("make, model, year, price, photo_urls")
    .is("sold_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      make: string;
      model: string;
      year: number | null;
      price: number | null;
      photo_urls: string[] | null;
    }>();
  const featuredName = featuredCar ? `${featuredCar.make} ${featuredCar.model}` : "SwitchApp";

  return (
    <div className="overflow-hidden">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 md:py-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div className="text-center lg:text-start">
          <p className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-brand-blue">{t("home.eyebrow")}</p>
          <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-brand-blue-dark md:text-6xl">{t("home.title")}</h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-muted lg:mx-0">{t("home.tagline")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/swipe" className="btn-primary px-6 py-3 text-base shadow-lg shadow-blue-700/20">{t("home.ctaSwipe")}</Link>
            <Link href="/business/join" className="btn-secondary px-6 py-3 text-base">{t("home.dealerCtaLink")}</Link>
          </div>
          <p className="mt-6 text-sm font-medium text-muted">{t("home.listingsCount", { count: count ?? 0 })}</p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-8 -z-10 rounded-full bg-blue-200/45 blur-3xl" />
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-2xl shadow-blue-950/15">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-brand-blue-dark to-brand-blue">
              {featuredCar?.photo_urls?.[0] ? <img src={featuredCar.photo_urls[0]} alt={featuredName} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,.24),transparent_24%),radial-gradient(circle_at_75%_80%,rgba(255,255,255,.18),transparent_30%)]" />}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-5 pb-5 pt-20 text-white">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{t("home.featuredLabel")}</span><span>♥</span></div>
                <p className="text-2xl font-bold">{featuredName}</p>
                <div className="mt-1 flex items-center justify-between text-sm text-white/90"><span>{featuredCar?.year ?? "—"}</span><span>{featuredCar?.price ? `₪${featuredCar.price.toLocaleString()}` : t("home.priceOnRequest")}</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pt-3 text-sm font-semibold text-neutral-500"><span>{t("home.swipeHint")}</span><span className="text-brand-pink">↔</span></div>
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-7 px-6 py-9 text-center sm:grid-cols-3 sm:divide-x sm:divide-neutral-200" dir="ltr">
          <div dir="auto"><p className="text-xl font-bold text-brand-blue-dark">01</p><p className="mt-1 text-sm text-muted">{t("home.benefitBrowse")}</p></div>
          <div dir="auto"><p className="text-xl font-bold text-brand-blue-dark">02</p><p className="mt-1 text-sm text-muted">{t("home.benefitMatch")}</p></div>
          <div dir="auto"><p className="text-xl font-bold text-brand-blue-dark">03</p><p className="mt-1 text-sm text-muted">{t("home.benefitChat")}</p></div>
        </div>
      </section>
    </div>
  );
}
