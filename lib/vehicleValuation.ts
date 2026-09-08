export type VehicleValuationInput = {
  askingPrice?: number | null;
  year?: number | null;
  mileage?: number | null;
  hand?: number | null;
  ownership?: "private" | "leasing" | "rental" | "commercial" | "unknown";
  accidentSeverity?: "none" | "minor" | "major" | "unknown";
  condition?: "excellent" | "good" | "fair" | "poor";
};

export type VehicleValuation = {
  marketLow: number;
  marketHigh: number;
  recommendedListing: number;
  quickSaleLow: number;
  quickSaleHigh: number;
  tradeLow: number;
  tradeHigh: number;
  confidence: "low" | "medium" | "high";
  factors: string[];
};

const round500 = (n: number) => Math.max(0, Math.round(n / 500) * 500);
const range = (center: number, pct: number): [number, number] => [round500(center * (1 - pct)), round500(center * (1 + pct))];

/**
 * MVP valuation model.
 * IMPORTANT: askingPrice is currently the anchor because SwitchApp does not yet
 * have a licensed market-price feed. This is an estimate, not an appraisal or
 * price-list replacement. When comparable listings / closed-deal data become
 * available, replace the anchor with a market median and keep these adjustments.
 */
export function estimateVehicleValue(input: VehicleValuationInput): VehicleValuation | null {
  const asking = Number(input.askingPrice || 0);
  if (!Number.isFinite(asking) || asking <= 0) return null;

  let multiplier = 1;
  const factors: string[] = [];
  const currentYear = new Date().getFullYear();
  const age = input.year ? Math.max(0, currentYear - input.year) : null;

  if (input.mileage != null && age != null) {
    const expected = Math.max(1, age) * 15000;
    const ratio = input.mileage / expected;
    if (ratio < 0.7) { multiplier += 0.025; factors.push("קילומטראז׳ נמוך ביחס לגיל הרכב"); }
    else if (ratio > 1.5) { multiplier -= 0.06; factors.push("קילומטראז׳ גבוה ביחס לגיל הרכב"); }
    else if (ratio > 1.2) { multiplier -= 0.03; factors.push("קילומטראז׳ מעל הממוצע"); }
  }

  if ((input.hand || 0) >= 4) { multiplier -= 0.035; factors.push("מספר בעלים גבוה"); }
  else if ((input.hand || 0) === 1) { multiplier += 0.01; factors.push("יד ראשונה"); }

  if (input.ownership === "leasing") { multiplier -= 0.055; factors.push("בעלות ליסינג"); }
  if (input.ownership === "rental") { multiplier -= 0.09; factors.push("בעלות השכרה"); }
  if (input.ownership === "commercial") { multiplier -= 0.04; factors.push("שימוש מסחרי"); }

  if (input.accidentSeverity === "minor") { multiplier -= 0.035; factors.push("עבר תאונתי קל"); }
  if (input.accidentSeverity === "major") { multiplier -= 0.14; factors.push("עבר תאונתי משמעותי"); }

  if (input.condition === "excellent") { multiplier += 0.025; factors.push("מצב כללי מצוין"); }
  if (input.condition === "fair") { multiplier -= 0.045; factors.push("מצב כללי בינוני"); }
  if (input.condition === "poor") { multiplier -= 0.11; factors.push("מצב כללי דורש טיפול"); }

  multiplier = Math.min(1.12, Math.max(0.65, multiplier));
  const center = round500(asking * multiplier);
  const [marketLow, marketHigh] = range(center, 0.04);
  const [quickSaleLow, quickSaleHigh] = range(center * 0.94, 0.025);
  const [tradeLow, tradeHigh] = range(center * 0.89, 0.03);

  const supplied = [input.year, input.mileage, input.hand, input.ownership, input.accidentSeverity, input.condition].filter(v => v != null && v !== "unknown").length;
  const confidence = supplied >= 5 ? "medium" : "low";

  return {
    marketLow,
    marketHigh,
    recommendedListing: round500(marketHigh * 1.015),
    quickSaleLow,
    quickSaleHigh,
    tradeLow,
    tradeHigh,
    confidence,
    factors,
  };
}

export function tradeDifference(targetPrice: number, tradeValue: number) {
  return round500(targetPrice - tradeValue);
}
