// Dealer subscription tiers, shared by the /business/join signup page (pricing table
// + tier picker) and the admin panel (showing what a pending dealer signed up to pay).
// `cap: null` is the "over 200 cars" row - no fixed price, contact us for a custom
// quote, so priceMonthly is null there too.
export interface DealerTier {
  cap: number | null;
  priceMonthly: number | null;
}

export const DEALER_TIERS: DealerTier[] = [
  { cap: 50, priceMonthly: 2500 },
  { cap: 100, priceMonthly: 3500 },
  { cap: 150, priceMonthly: 4500 },
  { cap: 200, priceMonthly: 5500 },
  { cap: null, priceMonthly: null },
];

export function tierPriceFor(cap: number | null): number | null {
  const tier = DEALER_TIERS.find((t) => t.cap === cap);
  return tier ? tier.priceMonthly : null;
}
