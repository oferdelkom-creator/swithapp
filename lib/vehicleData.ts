import type { VehicleType } from "./types";
import type { TranslationKey } from "./i18n/translations";

export const VEHICLE_TYPES: { value: VehicleType; labelKey: TranslationKey }[] = [
  { value: "car", labelKey: "vehicleType.car" },
  { value: "motorcycle", labelKey: "vehicleType.motorcycle" },
  { value: "truck", labelKey: "vehicleType.truck" },
  { value: "caravan", labelKey: "vehicleType.caravan" },
  { value: "jet_ski", labelKey: "vehicleType.jetSki" },
];

// "Other" is always appended to every make/model list so a real-world vehicle that
// isn't in our curated list can still be entered as free text, instead of blocking
// the listing entirely.
export const OTHER = "Other";

const CAR_MODELS: Record<string, string[]> = {
  Toyota: ["Corolla", "Yaris", "Camry", "RAV4", "C-HR", "Corolla Cross", "Highlander", "Prius", "Land Cruiser", "Hilux"],
  Hyundai: ["i10", "i20", "i30", "Elantra", "Tucson", "Santa Fe", "Kona", "Ioniq 5", "Accent"],
  Kia: ["Picanto", "Rio", "Ceed", "Sportage", "Sorento", "Niro", "Stonic", "EV6"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-30", "CX-60"],
  Skoda: ["Fabia", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Scala"],
  Suzuki: ["Swift", "Vitara", "S-Cross", "Baleno", "Ignis", "Jimny"],
  Mitsubishi: ["Mirage", "ASX", "Outlander", "Eclipse Cross", "L200"],
  Nissan: ["Micra", "Note", "Juke", "Qashqai", "X-Trail", "Leaf"],
  Honda: ["Jazz", "Civic", "CR-V", "HR-V", "Accord"],
  Ford: ["Fiesta", "Focus", "Kuga", "Puma", "Ranger", "Mustang"],
  Chevrolet: ["Spark", "Aveo", "Cruze", "Trax", "Captiva"],
  Renault: ["Clio", "Megane", "Captur", "Kadjar", "Talisman", "Zoe"],
  Peugeot: ["208", "308", "2008", "3008", "5008"],
  Citroen: ["C3", "C4", "C4 Cactus", "C5 Aircross"],
  Volkswagen: ["Polo", "Golf", "Passat", "Tiguan", "T-Roc", "ID.4", "Taos"],
  SEAT: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco"],
  Opel: ["Corsa", "Astra", "Mokka", "Crossland", "Grandland"],
  Fiat: ["500", "500X", "Tipo", "Panda"],
  Volvo: ["S60", "S90", "V60", "XC40", "XC60", "XC90"],
  BMW: ["1 Series", "3 Series", "5 Series", "X1", "X3", "X5", "i4", "iX"],
  "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "GLA", "GLC", "GLE", "EQA"],
  Audi: ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5", "e-tron"],
  Lexus: ["CT", "IS", "ES", "NX", "RX", "UX"],
  Subaru: ["Impreza", "XV", "Forester", "Outback"],
  Dacia: ["Sandero", "Duster", "Logan", "Spring"],
  MG: ["MG3", "MG5", "ZS", "HS", "MG4"],
  Chery: ["Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo 5"],
  BYD: ["Atto 3", "Dolphin", "Seal", "Han"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Mini: ["Cooper", "Countryman", "Clubman"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee"],
  "Land Rover": ["Discovery Sport", "Range Rover Evoque", "Defender", "Range Rover Sport"],
  Isuzu: ["D-Max"],
  SsangYong: ["Tivoli", "Korando", "Rexton"],
  [OTHER]: [],
};

const MOTORCYCLE_MODELS: Record<string, string[]> = {
  Yamaha: ["MT-07", "MT-09", "R1", "R3", "R6", "Tenere 700", "NMAX", "XMAX", "Tracer 9"],
  Honda: ["CB500F", "CB650R", "CBR500R", "Africa Twin", "PCX125", "Forza 350", "Gold Wing", "Rebel 500"],
  Kawasaki: ["Ninja 400", "Ninja 650", "Z650", "Z900", "Versys 650", "Vulcan S"],
  Suzuki: ["GSX-R600", "GSX-R750", "GSX-S750", "V-Strom 650", "Burgman 400"],
  BMW: ["G 310 R", "F 850 GS", "R 1250 GS", "S 1000 RR", "R nineT"],
  Ducati: ["Monster", "Panigale V2", "Multistrada", "Scrambler"],
  KTM: ["Duke 390", "Duke 790", "Adventure 390", "RC 390"],
  Triumph: ["Street Triple", "Tiger 900", "Bonneville", "Speed Triple"],
  Vespa: ["Primavera", "GTS 300", "Sprint"],
  Piaggio: ["Liberty", "Beverly", "MP3"],
  "Harley-Davidson": ["Iron 883", "Street Bob", "Fat Boy", "Road King"],
  [OTHER]: [],
};

const TRUCK_MODELS: Record<string, string[]> = {
  Volvo: ["FH", "FM", "FMX", "FL"],
  Scania: ["R Series", "S Series", "P Series", "G Series"],
  "Mercedes-Benz": ["Actros", "Atego", "Arocs", "Sprinter"],
  MAN: ["TGX", "TGS", "TGM", "TGL"],
  DAF: ["XF", "CF", "LF"],
  Iveco: ["Daily", "Eurocargo", "Stralis", "S-Way"],
  Isuzu: ["NPR", "FVR", "Elf"],
  Hino: ["300 Series", "500 Series", "700 Series"],
  Ford: ["Transit", "Transit Custom", "F-Max"],
  Renault: ["Master", "T Range", "D Range"],
  [OTHER]: [],
};

const CARAVAN_MODELS: Record<string, string[]> = {
  Hobby: ["De Luxe", "Premium", "Prestige"],
  Knaus: ["Sport", "Sudwind", "Van TI"],
  Adria: ["Adora", "Altea", "Astella"],
  Dethleffs: ["Camper", "Globebus", "Trend"],
  Burstner: ["Averso", "Premio", "Solano"],
  Fendt: ["Bianco", "Saphir", "Tendenza"],
  Bailey: ["Pursuit", "Unicorn", "Phoenix"],
  Swift: ["Challenger", "Sprite", "Basecamp"],
  [OTHER]: [],
};

const JET_SKI_MODELS: Record<string, string[]> = {
  "Sea-Doo": ["Spark", "GTI", "GTX", "RXP-X", "Fish Pro"],
  Yamaha: ["WaveRunner VX", "WaveRunner FX", "GP1800", "SuperJet"],
  Kawasaki: ["Jet Ski STX", "Jet Ski Ultra 310", "SX-R"],
  Honda: ["AquaTrax"],
  [OTHER]: [],
};

const MAKES_BY_TYPE: Record<VehicleType, Record<string, string[]>> = {
  car: CAR_MODELS,
  motorcycle: MOTORCYCLE_MODELS,
  truck: TRUCK_MODELS,
  caravan: CARAVAN_MODELS,
  jet_ski: JET_SKI_MODELS,
};

export function getMakes(type: VehicleType): string[] {
  const makes = Object.keys(MAKES_BY_TYPE[type] ?? {}).filter((m) => m !== OTHER);
  return [...makes.sort((a, b) => a.localeCompare(b)), OTHER];
}

export function getModels(type: VehicleType, make: string): string[] {
  const models = MAKES_BY_TYPE[type]?.[make] ?? [];
  return [...models, OTHER];
}
