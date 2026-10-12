export interface DealerTier {
  minCars: number;
  cap: number | null;
  requestValue: number;
  pricePerCar: number | null;
  monthlyPrice?: number;
}

// All prices include VAT. Every provider uses the same flat subscription.
export const DEALER_MONTHLY_PRICE = 499;
export const DEALER_TIERS: DealerTier[] = [
  { minCars: 0, cap: null, requestValue: 0, pricePerCar: null, monthlyPrice: DEALER_MONTHLY_PRICE },
];

export function tierForRequestedCap(cap: number | null): DealerTier {
  return DEALER_TIERS[0];
}

export const DEALER_SETUP_PRICE = 0;
export const CAMPAIGN_MANAGEMENT_RATE = 0.2;

export function monthlyInventoryPrice(plan: "small" | "lot", peak: number) {
  if (!Number.isSafeInteger(peak) || peak < 0) throw new Error("Invalid inventory count");
  return DEALER_MONTHLY_PRICE;
}

// Flat monthly add-on for pointing a dealer's own domain at their /d/[slug] page
// instead of switchapp.vercel.app/d/[slug] (on top of whichever tier above they're
// already on). A recommendation, not a fixed business decision from the dealer side -
// easy to tune in one place since /business/join's tier cards don't reference this.
export const CUSTOM_DOMAIN_ADDON_PRICE = 199;
export const DEALER_FREE_TRIAL_LIMIT = 0;
