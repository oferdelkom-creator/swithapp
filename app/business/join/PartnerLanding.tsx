"use client";

import { useLocale } from "@/components/LocaleProvider";
import { DEALER_TIERS } from "@/lib/dealerPricing";

const BENEFIT_KEYS = [
  "businessJoin.benefit1",
  "businessJoin.benefit2",
  "businessJoin.benefit3",
  "businessJoin.benefit4",
  "businessJoin.benefit5",
] as const;

export default function PartnerLanding({ remainingTrialSlots }: { remainingTrialSlots: number }) {
  const { t } = useLocale();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-[0.08em] text-brand-pink">{t("businessJoin.eyebrow")}</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("businessJoin.heroTitle")}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">{t("businessJoin.heroSubtitle")}</p>
        <div className={`mx-auto mt-5 max-w-xl rounded-2xl px-5 py-4 ${remainingTrialSlots > 0 ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
          <p className="font-semibold">{remainingTrialSlots > 0 ? t("businessJoin.freeTrialTitle") : t("businessJoin.freeTrialEndedTitle")}</p>
          <p className="mt-1 text-sm">
            {remainingTrialSlots > 0
              ? t("businessJoin.freeTrialDescription", { remaining: remainingTrialSlots })
              : t("businessJoin.freeTrialEndedDescription")}
          </p>
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/business/join/signup" className="btn-primary px-7 py-3 text-base">
            {t("businessJoin.submit")}
          </a>
          <a href="#pricing" className="btn-secondary px-7 py-3 text-base">
            {t("businessJoin.pricingTitle")}
          </a>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          <a href="/demo/dealer" className="text-brand-blue underline underline-offset-4">{t("businessJoin.viewDealerDemo")}</a>
          <span className="text-neutral-300">•</span>
          <a href="/demo/importer" className="text-brand-blue underline underline-offset-4">{t("businessJoin.viewImporterDemo")}</a>
        </div>
      </section>

      <section className="mt-16 grid gap-5 rounded-3xl bg-neutral-50 p-6 sm:grid-cols-2 sm:p-9">
        <div>
          <h2 className="text-2xl font-semibold">{t("businessJoin.whatYouGetTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-500">{t("businessJoin.systemDescription")}</p>
        </div>
        <ul className="space-y-3 text-sm text-neutral-700">
          {BENEFIT_KEYS.map((key) => (
            <li key={key} className="flex gap-3">
              <span className="font-bold text-emerald-600">✓</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" className="mt-16 scroll-mt-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">{t("businessJoin.pricingTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-500">{t("businessJoin.pricingSubtitle")}</p>
          <p className="mt-1 text-sm font-medium text-emerald-700">{t("businessJoin.minimumInventory")}</p>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {DEALER_TIERS.map((tier) => (
            <div key={tier.requestValue} className="card p-6">
              <p className="font-semibold">
                {tier.cap
                  ? t("businessJoin.tierRange", { min: tier.minCars, max: tier.cap })
                  : t("businessJoin.tierFrom", { count: tier.minCars })}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-blue">
                {tier.pricePerCar
                  ? t("businessJoin.perCarMonth", { price: tier.pricePerCar })
                  : t("businessJoin.tierCustomPrice")}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a href="/business/join/signup" className="btn-primary inline-flex px-8 py-3">
            {t("businessJoin.submit")}
          </a>
        </div>
      </section>
    </main>
  );
}
