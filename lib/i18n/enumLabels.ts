import type { CarRegion, FuelType } from "@/lib/types";
import type { Locale } from "./translations";

// car_region / fuel_type are stored as fixed English enum values in the DB - only the
// displayed label changes with locale, never the value sent back to Supabase.
const regionLabelsHe: Record<CarRegion, string> = {
  North: "צפון",
  Haifa: "חיפה",
  Center: "מרכז",
  "Tel Aviv": "תל אביב",
  Jerusalem: "ירושלים",
  Shfela: "שפלה",
  South: "דרום",
  "Judea and Samaria": "יהודה ושומרון",
};

const fuelTypeLabelsHe: Record<FuelType, string> = {
  Petrol: "בנזין",
  Diesel: "דיזל",
  Hybrid: "היברידי",
  Electric: "חשמלי",
  Gas: "גז",
};

export function regionLabel(region: CarRegion, locale: Locale): string {
  return locale === "he" ? regionLabelsHe[region] : region;
}

export function fuelTypeLabel(fuel: FuelType, locale: Locale): string {
  return locale === "he" ? fuelTypeLabelsHe[fuel] : fuel;
}
