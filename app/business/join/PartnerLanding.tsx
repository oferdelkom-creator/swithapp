"use client";

import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";
import { DEALER_TIERS } from "@/lib/dealerPricing";

const BENEFIT_KEYS = ["businessJoin.benefit1", "businessJoin.benefit2", "businessJoin.benefit3", "businessJoin.benefit4", "businessJoin.benefit5"] as const;

const BUSINESS_TYPES = [
  ["businessJoin.typeDealer", "businessJoin.typeDealerDescription", "D"],
  ["businessJoin.typeOfficialImporter", "businessJoin.typeOfficialImporterDescription", "O"],
  ["businessJoin.typeParallelImporter", "businessJoin.typeParallelImporterDescription", "P"],
] as const;

const PRODUCT_AREAS = [
  ["partnerLogin.inventory", "01"],
  ["partnerLogin.leads", "02"],
  ["partnerLogin.showroom", "03"],
] as const;

export default function PartnerLanding({ remainingTrialSlots }: { remainingTrialSlots: number }) {
  const { t } = useLocale();
  const trialOpen = remainingTrialSlots > 0;

  return (
    <main className="overflow-hidden bg-white text-slate-950">
      <section className="relative isolate border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#fff1f2_100%)]">
        <div className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(circle_at_20%_15%,rgba(29,78,216,.16),transparent_28%),radial-gradient(circle_at_85%_85%,rgba(255,68,88,.14),transparent_30%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("businessJoin.eyebrow")}
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-6xl">{t("businessJoin.heroTitle")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">{t("businessJoin.heroSubtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/signup" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800">
                {t("businessJoin.submit")} <span aria-hidden="true" className="ms-2">←</span>
              </a>
              <a href="/login" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-7 py-3.5 text-base font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-white">{t("partnerLogin.formTitle")}</a>
            </div>
            <div className={`mt-6 max-w-2xl rounded-2xl border px-4 py-3 ${trialOpen ? "border-emerald-200 bg-emerald-50/90 text-emerald-900" : "border-slate-200 bg-white/80 text-slate-700"}`}>
              <p className="font-semibold">{trialOpen ? t("businessJoin.freeTrialTitle") : t("businessJoin.freeTrialEndedTitle")}</p>
              <p className="mt-1 text-sm leading-6">{trialOpen ? t("businessJoin.freeTrialDescription", { remaining: remainingTrialSlots }) : t("businessJoin.freeTrialEndedDescription")}</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl" aria-label={t("businessJoin.whatYouGetTitle")}>
            <div className="absolute -inset-8 -z-10 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative min-h-[470px] overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-2xl shadow-slate-950/25 sm:min-h-[560px]">
              <Image src="/brand/switchautoai-showroom-hero.webp" alt="אולם תצוגה מודרני לניהול מלאי רכב באמצעות SwitchAuto AI" fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover object-left" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="mb-4 flex items-center gap-3 text-white">
                  <Image src="/brand/switchautoai-mark.svg" alt="" width={44} height={44} />
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">SwitchAuto AI</p><p className="font-bold">{t("businessJoin.systemDescription")}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRODUCT_AREAS.map(([key, number]) => <div key={key} className="rounded-2xl border border-white/15 bg-slate-950/70 p-3 text-white backdrop-blur"><span className="text-[10px] font-black text-blue-300">{number}</span><p className="mt-2 text-xs font-bold sm:text-sm">{t(key)}</p></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.16em] text-blue-700">SwitchAuto AI</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t("businessJoin.whatYouGetTitle")}</h2><p className="mt-4 text-lg leading-8 text-slate-600">{t("businessJoin.systemDescription")}</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {BUSINESS_TYPES.map(([title, description, mark], index) => (
            <article key={title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-black ${index === 1 ? "bg-blue-700" : index === 2 ? "bg-rose-500" : "bg-slate-950"} text-white`}>{mark}</div>
              <h3 className="mt-6 text-xl font-bold">{t(title)}</h3><p className="mt-2 leading-7 text-slate-600">{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="text-sm font-bold uppercase tracking-[.16em] text-blue-300">SwitchAuto AI</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t("businessJoin.whatYouGetTitle")}</h2><p className="mt-4 leading-7 text-slate-300">{t("businessJoin.heroSubtitle")}</p><div className="mt-8 flex flex-wrap gap-3"><a href="/demo/dealer" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-blue-50">{t("businessJoin.viewDealerDemo")}</a><a href="/demo/importer" className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">{t("businessJoin.viewImporterDemo")}</a></div></div>
          <ol className="grid gap-3">{BENEFIT_KEYS.map((key, index) => <li key={key} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-black">{index + 1}</span><span className="pt-1 leading-7 text-slate-100">{t(key)}</span></li>)}</ol>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t("businessJoin.pricingTitle")}</h2><p className="mt-3 text-slate-600">{t("businessJoin.pricingSubtitle")}</p><p className="mt-2 text-sm font-semibold text-emerald-700">{t("businessJoin.minimumInventory")}</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {DEALER_TIERS.map((tier, index) => (
              <article key={tier.requestValue} className={`relative rounded-3xl border bg-white p-6 ${index === 1 ? "border-blue-600 shadow-xl shadow-blue-950/10" : "border-slate-200 shadow-sm"}`}>
                {index === 1 ? <span className="absolute -top-3 end-5 rounded-full bg-blue-700 px-3 py-1 text-xs font-bold text-white">SwitchAuto AI</span> : null}
                <p className="font-bold text-slate-900">{tier.cap ? t("businessJoin.tierRange", { min: tier.minCars, max: tier.cap }) : t("businessJoin.tierFrom", { count: tier.minCars })}</p>
                <p className="mt-4 text-2xl font-black text-blue-700">{tier.pricePerCar ? t("businessJoin.perCarMonth", { price: tier.pricePerCar }) : t("businessJoin.tierCustomPrice")}</p>
                <a href="/signup" className="mt-7 inline-flex w-full justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">{t("businessJoin.submit")}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#1e3a8a,#0f172a_60%,#be123c)] px-6 py-12 text-center text-white shadow-2xl shadow-slate-950/20 sm:px-12 sm:py-16">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_15%_20%,white,transparent_22%),radial-gradient(circle_at_90%_80%,white,transparent_20%)]" />
          <div className="relative"><h2 className="text-3xl font-black tracking-tight sm:text-5xl">{t("businessJoin.heroTitle")}</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-blue-100">{t("businessJoin.heroSubtitle")}</p><a href="/signup" className="mt-8 inline-flex rounded-full bg-white px-8 py-3.5 font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-blue-50">{t("businessJoin.submit")}</a></div>
        </div>
      </section>
    </main>
  );
}
