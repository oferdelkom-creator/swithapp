"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { DEALER_TIERS } from "@/lib/dealerPricing";
import { finishDealerSignup } from "@/lib/dealerSignup";
import { isValidDealerSlug, normalizeCustomDomain, normalizeDealerSlug } from "@/lib/dealerDomains";
import { captureMarketingAttribution, trackMarketingEvent } from "@/lib/marketingAnalytics";

const BENEFIT_KEYS = [
  "businessJoin.benefit1",
  "businessJoin.benefit2",
  "businessJoin.benefit3",
  "businessJoin.benefit4",
  "businessJoin.benefit5",
] as const;

type BusinessType = "dealer" | "official_importer" | "parallel_importer";

const BUSINESS_TYPES: {
  value: BusinessType;
  role: "dealer" | "importer";
  labelKey: "businessJoin.typeDealer" | "businessJoin.typeOfficialImporter" | "businessJoin.typeParallelImporter";
  descriptionKey:
    | "businessJoin.typeDealerDescription"
    | "businessJoin.typeOfficialImporterDescription"
    | "businessJoin.typeParallelImporterDescription";
}[] = [
  { value: "dealer", role: "dealer", labelKey: "businessJoin.typeDealer", descriptionKey: "businessJoin.typeDealerDescription" },
  { value: "official_importer", role: "importer", labelKey: "businessJoin.typeOfficialImporter", descriptionKey: "businessJoin.typeOfficialImporterDescription" },
  { value: "parallel_importer", role: "importer", labelKey: "businessJoin.typeParallelImporter", descriptionKey: "businessJoin.typeParallelImporterDescription" },
];

export default function DealerJoinForm({ remainingTrialSlots }: { remainingTrialSlots: number }) {
  const { t } = useLocale();
  const router = useRouter();
  const [businessType, setBusinessType] = useState<BusinessType>("dealer");
  const [tier, setTier] = useState<number | null | undefined>(undefined);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dealerSlug, setDealerSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => captureMarketingAttribution(), []);

  function localizedSignupError(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes("already registered") || normalized.includes("already been registered")) {
      return "כתובת האימייל כבר רשומה. אפשר להתחבר לחשבון הקיים.";
    }
    if (normalized.includes("password") && normalized.includes("least")) {
      return "הסיסמה קצרה מדי. יש להזין לפחות 6 תווים.";
    }
    if (normalized.includes("invalid email")) return "כתובת האימייל אינה תקינה.";
    if (normalized.includes("rate limit")) return "בוצעו יותר מדי ניסיונות. המתינו מספר דקות ונסו שוב.";
    return "לא הצלחנו להשלים את ההרשמה כרגע. בדקו את הפרטים ונסו שוב.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tier === undefined) {
      setError(t("businessJoin.selectTierError"));
      return;
    }
    const cleanedSlug = normalizeDealerSlug(dealerSlug);
    if (!isValidDealerSlug(cleanedSlug)) {
      setError(t("businessJoin.slugError"));
      return;
    }
    const cleanedDomain = customDomain.trim() ? normalizeCustomDomain(customDomain) : null;
    if (customDomain.trim() && !cleanedDomain) {
      setError(t("businessJoin.domainError"));
      return;
    }
    setLoading(true);
    const supabase = createClient();

    const availabilityChecks = [
      supabase.from("users").select("id").eq("dealer_slug", cleanedSlug).limit(1),
      ...(cleanedDomain ? [supabase.from("users").select("id").eq("custom_domain", cleanedDomain).limit(1)] : []),
    ];
    const availability = await Promise.all(availabilityChecks);
    if (availability.some(({ data, error: checkError }) => checkError || (data?.length ?? 0) > 0)) {
      setError(t("businessJoin.addressTaken"));
      setLoading(false);
      return;
    }

    const role = BUSINESS_TYPES.find((type) => type.value === businessType)!.role;
    const finishPath = `/business/join/finish?business_name=${encodeURIComponent(businessName)}&cap=${
      tier ?? ""
    }&phone=${encodeURIComponent(phone)}&role=${role}&dealer_slug=${encodeURIComponent(cleanedSlug)}&custom_domain=${encodeURIComponent(cleanedDomain ?? "")}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: contactName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(finishPath)}`,
      },
    });

    if (signUpError) {
      setError(localizedSignupError(signUpError.message));
      setLoading(false);
      return;
    }

    if (!data.session || !data.user) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    try {
      await finishDealerSignup(supabase, {
        userId: data.user.id,
        businessName,
        cap: tier,
        phone,
        role,
        dealerSlug: cleanedSlug,
        customDomain: cleanedDomain,
      });
      await fetch("/api/notifications/new-customer", { method: "POST" }).catch(() => undefined);
      trackMarketingEvent("partner_signup_complete", { business_type: businessType, tier: tier ?? "custom" });
    } catch (signupError) {
      const message = signupError instanceof Error ? signupError.message : String(signupError);
      setError(message.includes("duplicate") ? t("businessJoin.addressTaken") : localizedSignupError(message));
      setLoading(false);
      return;
    }
    router.push("/business");
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="card p-8">
          <p className="text-lg font-medium mb-2">{t("businessJoin.confirmEmailTitle")}</p>
          <p className="text-neutral-500 text-sm">{t("businessJoin.confirmEmailBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("businessJoin.heroTitle")}</h1>
        <p className="mt-3 text-neutral-500">{t("businessJoin.heroSubtitle")}</p>
        <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${remainingTrialSlots > 0 ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
          {remainingTrialSlots > 0
            ? t("businessJoin.freeTrialDescription", { remaining: remainingTrialSlots })
            : t("businessJoin.freeTrialEndedDescription")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {BUSINESS_TYPES.map((type) => {
          const selected = businessType === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setBusinessType(type.value)}
              className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                selected ? "border-brand-pink bg-[#fff1f3]" : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <p className="font-semibold">{t(type.labelKey)}</p>
              <p className="mt-1 text-xs text-neutral-500">{t(type.descriptionKey)}</p>
            </button>
          );
        })}
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold">{t("businessJoin.whatYouGetTitle")}</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          {BENEFIT_KEYS.map((key) => (
            <li key={key} className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-semibold mb-1">{t("businessJoin.pricingTitle")}</h2>
        <p className="text-sm text-neutral-500 mb-4">{t("businessJoin.pricingSubtitle")}</p>
        <p className="mb-4 text-sm font-medium text-emerald-700">{t("businessJoin.minimumInventory")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DEALER_TIERS.map((tierOption) => {
            const selected = tier === tierOption.requestValue;
            return (
              <button
                key={tierOption.requestValue}
                type="button"
                onClick={() => setTier(tierOption.requestValue)}
                className={`text-start rounded-2xl p-4 border-2 transition-colors ${
                  selected ? "border-brand-pink bg-[#fff1f3]" : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <p className="font-medium">
                  {tierOption.cap
                    ? t("businessJoin.tierRange", { min: tierOption.minCars, max: tierOption.cap })
                    : t("businessJoin.tierFrom", { count: tierOption.minCars })}
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  {tierOption.pricePerCar
                    ? t("businessJoin.perCarMonth", { price: tierOption.pricePerCar })
                    : t("businessJoin.tierCustomPrice")}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <h2 className="font-semibold">{t("businessJoin.formTitle")}</h2>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.businessName")}</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            onBlur={() => {
              if (!dealerSlug) setDealerSlug(normalizeDealerSlug(businessName));
            }}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.storeAddress")}</label>
          <div className="flex" dir="ltr">
            <input required value={dealerSlug} onChange={(e) => setDealerSlug(normalizeDealerSlug(e.target.value))} placeholder="my-dealership" className="field w-full rounded-r-none" />
            <span className="inline-flex items-center rounded-r-xl border border-l-0 border-neutral-300 bg-neutral-50 px-3 text-xs text-neutral-600">.switchapp.co.il</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{t("businessJoin.storeAddressHint")}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.existingDomain")}</label>
          <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="www.my-dealership.co.il" className="field" dir="ltr" />
          <p className="mt-1 text-xs text-neutral-500">{t("businessJoin.existingDomainHint")}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.contactName")}</label>
          <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.email")}</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.phone")}</label>
          <div className="flex" dir="ltr">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-sm font-medium text-neutral-600">
              +972
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="50-1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field w-full rounded-l-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("businessJoin.password")}</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t("businessJoin.wait") : t("businessJoin.submit")}
        </button>

        <p className="text-center text-sm text-neutral-500">
          {t("businessJoin.alreadyHaveAccount")}{" "}
          <Link href="/business/login?next=/business" className="text-brand-blue">
            {t("login.signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
