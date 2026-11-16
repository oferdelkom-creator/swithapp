// Exact known Ministry alias only; never strip arbitrary country/brand suffixes.
export function normalizeVehicleMake(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/\s+/g, " ") === "יונדאי טורקיה" ? "יונדאי" : trimmed;
}
