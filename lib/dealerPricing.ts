export interface DealerTier {
  minCars: number;
  cap: number | null;
  requestValue: number;
  pricePerCar: number | null;
}

// All prices include VAT. Monthly inventory is the calendar-month peak.
export const DEALER_TIERS: DealerTier[] = [
  { minCars: 1, cap: 10, requestValue: 10, pricePerCar: 100 },
  { minCars: 40, cap: null, requestValue: 40, pricePerCar: 50 },
];

export function tierForRequestedCap(cap: number | null): DealerTier {
  if (cap === 10) return DEALER_TIERS[0];
  return DEALER_TIERS[1];
}

export const DEALER_SETUP_PRICE = 3000;
export const CAMPAIGN_MANAGEMENT_RATE = 0.2;

export function monthlyInventoryPrice(plan: "small" | "lot", peak: number) {
  if (!Number.isSafeInteger(peak) || peak < 0) throw new Error("Invalid inventory count");
  if (plan === "small") {
    if (peak > 10) throw new Error("Small dealer plan supports up to 10 active vehicles");
    return peak * 100;
  }
  return Math.max(40, peak) * 50;
}

// Flat monthly add-on for pointing a dealer's own domain at their /d/[slug] page
// instead of switchapp.vercel.app/d/[slug] (on top of whichever tier above they're
// already on). A recommendation, not a fixed business decision from the dealer side -
// easy to tune in one place since /business/join's tier cards don't reference this.
export const CUSTOM_DOMAIN_ADDON_PRICE = 199;
export const DEALER_FREE_TRIAL_LIMIT = 0;
