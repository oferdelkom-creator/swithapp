import { VEHICLE_TYPES, getMakes, OTHER } from "./vehicleData";
import type { CarRegion, VehicleType } from "./types";

// A local, keyword/regex-based stand-in for "AI search" (mobile.de's free-text box)
// - there's no LLM API key configured anywhere in this project, so this can't be a
// real natural-language search. It understands a fixed set of common English/Hebrew
// phrasings (make names, "electric", price/year/mileage ranges, region names) well
// enough to be useful for typical queries, and simply matches nothing it doesn't
// recognize rather than guessing - the caller shows what it did understand so a
// wrong/partial parse is visible and correctable via the regular filter panel.
export interface ParsedSearch {
  vehicleType: VehicleType | null;
  make: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minYear: number | null;
  maxYear: number | null;
  maxMileage: number | null;
  electricOnly: boolean;
  region: CarRegion | null;
}

const TYPE_KEYWORDS: [VehicleType, string[]][] = [
  ["motorcycle", ["motorcycle", "motorbike", "אופנוע"]],
  ["scooter", ["scooter", "קטנוע"]],
  ["truck", ["truck", "pickup", "משאית", "טנדר"]],
  ["bus", ["bus", "minibus", "אוטובוס"]],
  ["caravan", ["caravan", "rv", "motorhome", "קרוואן"]],
  ["jet_ski", ["jet ski", "jetski", "ג'ט סקי", "גטסקי"]],
  ["atv", ["atv", "quad", "טרקטורון"]],
  ["boat", ["boat", "יאכטה", "סירה"]],
  // "car" last and broadest - checked only if nothing more specific matched.
  ["car", ["car", "sedan", "suv", "hatchback", "wagon", "jeep", "רכב", "מכונית", "סטיישן", "ג'יפ"]],
];

const ELECTRIC_KEYWORDS = ["electric", " ev ", "ev,", "ev.", "חשמלי", "חשמלית"];

const REGION_KEYWORDS: [CarRegion, string[]][] = [
  ["Tel Aviv", ["tel aviv", "תל אביב", "תל-אביב"]],
  ["Judea and Samaria", ["judea", "samaria", "יהודה ושומרון"]],
  ["North", ["north", "צפון"]],
  ["Haifa", ["haifa", "חיפה"]],
  ["Center", ["center", "מרכז"]],
  ["Jerusalem", ["jerusalem", "ירושלים"]],
  ["Shfela", ["shfela", "שפלה"]],
  ["South", ["south", "דרום"]],
];

function parseAmount(digits: string, suffix?: string): number {
  const n = Number(digits.replace(/,/g, ""));
  return suffix && suffix.toLowerCase() === "k" ? n * 1000 : n;
}

function isPlausibleYear(n: number): boolean {
  return n >= 1980 && n <= 2036;
}

// Every known make across every vehicle type, longest name first so "Land Rover"
// matches before a shorter unrelated substring could.
const ALL_MAKES = Array.from(new Set(VEHICLE_TYPES.flatMap((vt) => getMakes(vt.value))))
  .filter((m) => m !== OTHER)
  .sort((a, b) => b.length - a.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSearchQuery(query: string): ParsedSearch {
  const q = ` ${query.toLowerCase()} `;
  const result: ParsedSearch = {
    vehicleType: null,
    make: null,
    minPrice: null,
    maxPrice: null,
    minYear: null,
    maxYear: null,
    maxMileage: null,
    electricOnly: false,
    region: null,
  };

  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((kw) => q.includes(kw))) {
      result.vehicleType = type;
      break;
    }
  }

  if (ELECTRIC_KEYWORDS.some((kw) => q.includes(kw))) result.electricOnly = true;

  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((kw) => q.includes(kw))) {
      result.region = region;
      break;
    }
  }

  for (const make of ALL_MAKES) {
    const re = new RegExp(`(^|[^a-z0-9א-ת])${escapeRegExp(make.toLowerCase())}([^a-z0-9א-ת]|$)`);
    if (re.test(q)) {
      result.make = make;
      break;
    }
  }

  // Mileage - most specific pattern (requires a km unit), extracted first so its
  // digits can't also be picked up by the broader price/year patterns below.
  let working = q;
  const mileageMatch = working.match(/(?:under|below|up ?to|max|עד)\s*([\d,]+)\s*(?:km|ק"?מ)/i);
  if (mileageMatch) {
    result.maxMileage = parseAmount(mileageMatch[1]);
    working = working.replace(mileageMatch[0], " ");
  }

  // Year range - only a "from/since/until/before + plausible year" phrasing counts,
  // so a price like "from 20000" isn't misread as the year 20000.
  const yearFromMatch = working.match(/(?:from|since|משנת|החל מ)\s*(\d{4})/i);
  if (yearFromMatch && isPlausibleYear(Number(yearFromMatch[1]))) {
    result.minYear = Number(yearFromMatch[1]);
    working = working.replace(yearFromMatch[0], " ");
  }
  const yearToMatch = working.match(/(?:until|before|עד שנת)\s*(\d{4})/i);
  if (yearToMatch && isPlausibleYear(Number(yearToMatch[1]))) {
    result.maxYear = Number(yearToMatch[1]);
    working = working.replace(yearToMatch[0], " ");
  }

  // Price - "up to/under/below/max/עד" and "from/over/above/min/מ/מעל" followed by a
  // number, optional k suffix. A number left over in the year-plausible range at this
  // point is treated as a year instead (e.g. "up to 2020" almost certainly means the
  // model year, not a 2,020-shekel car), everything else as a price.
  const maxMatch = working.match(/(?:up ?to|under|below|max|עד)\s*[₪$]?\s*([\d,]+)\s*(k)?/i);
  if (maxMatch) {
    const amount = parseAmount(maxMatch[1], maxMatch[2]);
    if (isPlausibleYear(amount) && !maxMatch[2]) result.maxYear = result.maxYear ?? amount;
    else result.maxPrice = amount;
    working = working.replace(maxMatch[0], " ");
  }
  const minMatch = working.match(/(?:over|above|from|min|מעל|^מ-?|\sמ-?)\s*[₪$]?\s*([\d,]+)\s*(k)?/i);
  if (minMatch) {
    const amount = parseAmount(minMatch[1], minMatch[2]);
    if (isPlausibleYear(amount) && !minMatch[2]) result.minYear = result.minYear ?? amount;
    else result.minPrice = amount;
  }

  return result;
}
