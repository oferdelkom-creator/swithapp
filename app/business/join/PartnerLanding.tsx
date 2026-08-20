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

export default function PartnerLanding() {
  const { t } = useLocale();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-pink">SwitchApp for business</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("businessJoin.heroTitle")}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">{t("businessJoin.heroSubtitle")}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/business/join/signup" className="btn-primary px-7 py-3 text-base">
            {t("businessJoin.submit")}
          </a>
          <a href="#pricing" className="btn-secondary px-7 py-3 text-base">
            {t("businessJoin.pricingTitle")}
          </a>
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
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {DEALER_TIERS.map((tier) => (
            <div key={tier.cap ?? "custom"} className="card p-6">
              <p className="font-semibold">
                {tier.cap ? t("businessJoin.tierUpTo", { count: tier.cap }) : t("businessJoin.tierCustomLabel")}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-blue">
                {tier.priceMonthly ? t("businessJoin.perMonth", { price: tier.priceMonthly.toLocaleString() }) : t("businessJoin.tierCustomPrice")}
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
