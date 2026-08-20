export interface DealerTier {
  minCars: number;
  cap: number | null;
  requestValue: number;
  pricePerCar: number | null;
}

// There is deliberately no package below 10 vehicles. The first two tiers are
// charged per active vehicle each month; 200+ is quoted individually.
export const DEALER_TIERS: DealerTier[] = [
  { minCars: 10, cap: 49, requestValue: 49, pricePerCar: 100 },
  { minCars: 50, cap: 199, requestValue: 199, pricePerCar: 50 },
  { minCars: 200, cap: null, requestValue: 200, pricePerCar: null },
];

export function tierForRequestedCap(cap: number | null): DealerTier {
  // Preserve the meaning of accounts created under the old 10/50 cap values.
  if (cap === 10) return DEALER_TIERS[0];
  if (cap === 50) return DEALER_TIERS[1];
  return DEALER_TIERS.find((tier) => tier.requestValue === cap) ?? DEALER_TIERS[0];
}

// Flat monthly add-on for pointing a dealer's own domain at their /d/[slug] page
// instead of switchapp.vercel.app/d/[slug] (on top of whichever tier above they're
// already on). A recommendation, not a fixed business decision from the dealer side -
// easy to tune in one place since /business/join's tier cards don't reference this.
export const CUSTOM_DOMAIN_ADDON_PRICE = 199;
export const DEALER_FREE_TRIAL_LIMIT = 30;
