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

const regionLabelsRu: Record<CarRegion, string> = {
  North: "Север",
  Haifa: "Хайфа",
  Center: "Центр",
  "Tel Aviv": "Тель-Авив",
  Jerusalem: "Иерусалим",
  Shfela: "Шфела",
  South: "Юг",
  "Judea and Samaria": "Иудея и Самария",
};

const fuelTypeLabelsHe: Record<FuelType, string> = {
  Petrol: "בנזין",
  Diesel: "דיזל",
  Hybrid: "היברידי",
  Electric: "חשמלי",
  Gas: "גז",
};

const fuelTypeLabelsRu: Record<FuelType, string> = {
  Petrol: "Бензин",
  Diesel: "Дизель",
  Hybrid: "Гибрид",
  Electric: "Электро",
  Gas: "Газ",
};

export function regionLabel(region: CarRegion, locale: Locale): string {
  if (locale === "he") return regionLabelsHe[region];
  if (locale === "ru") return regionLabelsRu[region];
  return region;
}

export function fuelTypeLabel(fuel: FuelType, locale: Locale): string {
  if (locale === "he") return fuelTypeLabelsHe[fuel];
  if (locale === "ru") return fuelTypeLabelsRu[fuel];
  return fuel;
}
