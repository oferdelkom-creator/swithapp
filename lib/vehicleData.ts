import type { VehicleType } from "./types";
import type { TranslationKey } from "./i18n/translations";

// Mirrors Yad2's real vehicle category tree as closely as practical (researched via
// public scraper source + Israeli importer/trade-press sites - yad2.co.il itself
// couldn't be fetched directly from this sandbox, see README). Yad2 splits scooters
// and ATVs/quads out from motorcycles, and bundles jet skis with motor boats under one
// "watercraft" category - we keep jet_ski and boat as separate types instead, since
// that distinction is more useful for matching swap candidates than Yad2's need for a
// single search filter.
export const VEHICLE_TYPES: { value: VehicleType; labelKey: TranslationKey }[] = [
  { value: "car", labelKey: "vehicleType.car" },
  { value: "motorcycle", labelKey: "vehicleType.motorcycle" },
  { value: "scooter", labelKey: "vehicleType.scooter" },
  { value: "truck", labelKey: "vehicleType.truck" },
  { value: "bus", labelKey: "vehicleType.bus" },
  { value: "caravan", labelKey: "vehicleType.caravan" },
  { value: "jet_ski", labelKey: "vehicleType.jetSki" },
  { value: "atv", labelKey: "vehicleType.atv" },
  { value: "boat", labelKey: "vehicleType.boat" },
];

// "Other" is always appended to every make/model list so a real-world vehicle that
// isn't in our curated list can still be entered as free text, instead of blocking
// the listing entirely.
export const OTHER = "Other";

const CAR_MODELS: Record<string, string[]> = {
  Toyota: ["Corolla", "Corolla Cross", "Yaris", "Yaris Cross", "Camry", "RAV4", "C-HR", "Highlander", "Land Cruiser", "Land Cruiser Prado", "Hilux", "Prius", "Auris", "Aygo", "GR86", "Supra", "bZ4X"],
  Hyundai: ["i10", "i20", "i30", "Elantra", "Accent", "Tucson", "Santa Fe", "Kona", "Bayon", "ix35", "Ioniq", "Ioniq 5", "Ioniq 6", "Getz", "Sonata"],
  Kia: ["Picanto", "Rio", "Ceed", "ProCeed", "Sportage", "Sorento", "Niro", "Soul", "Stonic", "Optima", "Cerato", "Carnival", "Xceed", "EV6", "EV9"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-30", "CX-60", "CX-9", "MX-5", "MX-30", "Mazda5", "323", "CX-7"],
  Skoda: ["Fabia", "Octavia", "Superb", "Kodiaq", "Karoq", "Kamiq", "Scala", "Rapid", "Yeti", "Roomster", "Citigo", "Enyaq"],
  Suzuki: ["Swift", "Swift Sport", "Vitara", "Grand Vitara", "S-Cross", "Ignis", "Baleno", "Celerio", "Jimny", "SX4", "Alto", "Splash", "Ertiga"],
  Mitsubishi: ["Outlander", "ASX", "Eclipse Cross", "Space Star", "Colt", "Lancer", "Pajero", "Pajero Sport", "L200", "Mirage", "Attrage", "Galant"],
  Nissan: ["Micra", "Note", "Juke", "Qashqai", "X-Trail", "Leaf", "Navara", "Pathfinder", "Almera", "Pulsar", "Sunny", "Patrol", "Kicks", "Ariya"],
  Honda: ["Civic", "Civic Type R", "Jazz", "CR-V", "HR-V", "Accord", "Insight", "e", "City", "CR-Z", "Legend", "Pilot"],
  Ford: ["Fiesta", "Focus", "Mondeo", "Kuga", "EcoSport", "Puma", "Edge", "Ranger", "Mustang", "Mustang Mach-E", "S-Max", "Galaxy", "C-Max"],
  Chevrolet: ["Spark", "Aveo", "Cruze", "Malibu", "Trax", "Captiva", "Orlando", "Camaro", "Corvette", "Volt", "Bolt EV", "Epica", "Lacetti"],
  Renault: ["Clio", "Megane", "Megane E-Tech", "Captur", "Kadjar", "Koleos", "Talisman", "Twingo", "Scenic", "Grand Scenic", "Fluence", "Zoe", "Arkana"],
  Peugeot: ["108", "208", "e-208", "2008", "e-2008", "308", "3008", "5008", "508", "206", "207", "301", "RCZ"],
  Citroen: ["C1", "C3", "C3 Aircross", "C4", "C4 Cactus", "C4 Picasso", "Grand C4 Picasso", "C5", "C5 Aircross", "C6", "DS3", "e-C4"],
  Volkswagen: ["Polo", "Golf", "Golf GTI", "Jetta", "Passat", "Tiguan", "T-Roc", "T-Cross", "Touareg", "Arteon", "Up!", "Beetle", "ID.3", "ID.4", "Touran"],
  SEAT: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Mii", "Toledo", "Cordoba", "Altea", "Exeo"],
  Cupra: ["Formentor", "Leon", "Born", "Ateca", "Tavascan"],
  Opel: ["Corsa", "Astra", "Astra GTC", "Insignia", "Mokka", "Crossland", "Grandland", "Adam", "Karl", "Zafira", "Meriva", "Vectra", "Antara"],
  Fiat: ["500", "500X", "500L", "500e", "Panda", "Tipo", "Punto", "Bravo", "Freemont", "124 Spider", "Sedici", "Croma"],
  Volvo: ["S60", "S80", "S90", "V40", "V60", "V70", "V90", "XC40", "XC60", "XC90", "C30", "C40", "EX30", "EX90"],
  BMW: ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X1", "X2", "X3", "X5", "X6", "Z4", "i3", "i4", "iX"],
  Mini: ["Cooper", "Countryman", "Clubman", "Convertible", "Aceman"],
  "Mercedes-Benz": ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "G-Class", "EQA"],
  Smart: ["ForTwo", "ForFour", "#1"],
  Audi: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "TT", "e-tron", "Q4 e-tron"],
  Lexus: ["IS", "ES", "GS", "LS", "CT", "UX", "NX", "RX", "GX", "LX", "RC", "LC", "RZ"],
  Subaru: ["Impreza", "Legacy", "Outback", "Forester", "XV/Crosstrek", "WRX", "WRX STI", "BRZ", "Levorg", "Tribeca", "Justy"],
  Dacia: ["Sandero", "Sandero Stepway", "Logan", "Duster", "Lodgy", "Dokker", "Spring"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Avenger"],
  Chrysler: ["300", "Pacifica", "Voyager"],
  Jaguar: ["F-Pace", "E-Pace", "XE", "XF", "F-Type", "I-Pace"],
  "Land Rover": ["Discovery Sport", "Discovery", "Range Rover Evoque", "Range Rover Velar", "Defender", "Range Rover Sport", "Range Rover"],
  Porsche: ["911", "718", "Cayenne", "Macan", "Panamera", "Taycan"],
  "Alfa Romeo": ["Giulia", "Stelvio", "Giulietta", "Tonale"],
  Abarth: ["500", "595", "695"],
  "DS Automobiles": ["DS3", "DS4", "DS7", "DS9"],
  Isuzu: ["D-Max"],
  SsangYong: ["Tivoli", "Korando", "Rexton", "Torres"],
  Genesis: ["G70", "G80", "G90", "GV70", "GV80"],
  Infiniti: ["Q50", "QX50", "QX60"],
  Cadillac: ["Escalade", "CT5", "XT5", "Lyriq"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  Polestar: ["2", "3", "4"],
  BYD: ["Atto 3", "Dolphin", "Seal", "Seal U", "Song Plus", "Han", "Tang", "Qin"],
  Chery: ["Tiggo 2", "Tiggo 3", "Tiggo 4", "Tiggo 7", "Tiggo 7 Pro", "Tiggo 8", "Tiggo 8 Pro", "Arrizo 5", "Arrizo 6"],
  Omoda: ["Omoda 5", "Omoda C5", "Omoda E5"],
  Jaecoo: ["Jaecoo 7", "Jaecoo 8"],
  Haval: ["H6", "Jolion", "H9", "Dargo"],
  GWM: ["Tank 300", "Poer"],
  Ora: ["Funky Cat", "Good Cat"],
  JAC: ["JS4", "JS6", "JS8", "Sunray"],
  Voyah: ["Free", "Dreamer", "Passion"],
  Skywell: ["ET5"],
  "GAC Aion": ["Y Plus", "S", "V"],
  Avatr: ["11", "12"],
  BAIC: ["X55", "U5"],
  "IM Motors": ["LS7", "L7"],
  MG: ["MG3", "MG4", "MG5", "MG6", "ZS", "ZS EV", "HS", "Marvel R", "Cyberster"],
  Geely: ["Coolray", "Emgrand", "Monjaro", "Preface"],
  Zeekr: ["001", "009", "X"],
  "Lynk & Co": ["01", "03", "06", "09"],
  Deepal: ["S07", "SL03"],
  Changan: ["CS35", "CS55", "UNI-T", "Eado"],
  Leapmotor: ["C10", "T03"],
  Forthing: ["T5 Evo", "Yusheng S60"],
  Dongfeng: ["Box", "AX7"],
  Hongqi: ["H5", "E-HS9"],
  Xpeng: ["G6", "G9", "P7"],
  NIO: ["ET5", "ES6"],
  Maxus: ["T60", "Deliver 9", "Euniq 6"],
  Exeed: ["LX", "TXL", "VX"],
  Aiways: ["U5", "U6"],
  [OTHER]: [],
};

const MOTORCYCLE_MODELS: Record<string, string[]> = {
  Yamaha: ["MT-07", "MT-09", "R1", "R3", "R6", "Tenere 700", "NMAX", "XMAX", "Tracer 9"],
  Kawasaki: ["Ninja 400", "Ninja 650", "Z650", "Z900", "Versys 650", "Vulcan S"],
  Honda: ["CB500F", "CB650R", "CBR500R", "Africa Twin", "PCX125", "Forza 350", "Gold Wing", "Rebel 500"],
  Suzuki: ["GSX-R600", "GSX-R750", "GSX-S750", "V-Strom 650", "Burgman 400"],
  SYM: ["Wolf 125", "Maxsym 400", "Jet 14"],
  Beta: ["RR 350", "Xtrainer", "Alp 200"],
  NIU: ["NQi", "MQi", "UQi"],
  Kymco: ["Xciting 400", "AK 550", "People S"],
  Piaggio: ["MP3", "Beverly"],
  Vespa: ["Primavera", "GTS 300", "Sprint"],
  Aprilia: ["RS 660", "Tuono 660", "SR GT"],
  "Moto Guzzi": ["V7", "V85 TT"],
  Husqvarna: ["Svartpilen 401", "Vitpilen 401", "701 Enduro"],
  CFMOTO: ["300NK", "650MT", "700CL-X"],
  KTM: ["Duke 390", "Duke 790", "Adventure 390", "RC 390"],
  Indian: ["Scout", "Chief", "FTR"],
  "Royal Enfield": ["Classic 350", "Meteor 350", "Himalayan"],
  "Peugeot Motocycles": ["Django", "Speedfight"],
  Ducati: ["Monster", "Panigale V2", "Multistrada", "Scrambler"],
  "BMW Motorrad": ["G 310 R", "F 850 GS", "R 1250 GS", "S 1000 RR", "R nineT"],
  Triumph: ["Street Triple", "Tiger 900", "Bonneville", "Speed Triple"],
  "Harley-Davidson": ["Iron 883", "Street Bob", "Fat Boy", "Road King"],
  Benelli: ["TRK 502", "Leoncino 500"],
  "Zero Motorcycles": ["SR/F", "FXE"],
  [OTHER]: [],
};

const SCOOTER_MODELS: Record<string, string[]> = {
  SYM: ["Jet 14", "Symphony", "Fiddle III"],
  Kymco: ["People S", "Agility 125", "Like 125"],
  Piaggio: ["Liberty", "Medley"],
  Vespa: ["Primavera", "Sprint", "GTS 300"],
  NIU: ["NQi Sport", "MQi GT"],
  Yamaha: ["NMAX", "XMAX", "Aerox"],
  Honda: ["PCX125", "SH150i", "Forza 350"],
  Aprilia: ["SR GT", "SR 50"],
  [OTHER]: [],
};

const TRUCK_MODELS: Record<string, string[]> = {
  Volvo: ["FH", "FM", "FMX", "FL"],
  Scania: ["R Series", "S Series", "P Series", "G Series"],
  "Mercedes-Benz": ["Actros", "Atego", "Arocs", "Sprinter"],
  MAN: ["TGX", "TGS", "TGM", "TGL"],
  DAF: ["XF", "CF", "LF"],
  Iveco: ["Daily", "Eurocargo", "Stralis", "S-Way"],
  Fiat: ["Ducato"],
  Isuzu: ["NPR", "FVR", "Elf"],
  Nissan: ["Cabstar", "Atlas"],
  JAC: ["N-Series", "X-Series"],
  Hyundai: ["Mighty", "HD65"],
  Ford: ["Transit", "Transit Custom", "F-Max"],
  Renault: ["Master", "T Range", "D Range"],
  Kenworth: ["T680", "T880"],
  Tatra: ["Phoenix", "Force"],
  Hino: ["300 Series", "500 Series", "700 Series"],
  "Mitsubishi Fuso": ["Canter", "Fighter"],
  [OTHER]: [],
};

const BUS_MODELS: Record<string, string[]> = {
  "Mercedes-Benz": ["Sprinter", "Tourismo", "Travego", "Citaro"],
  Volvo: ["9700", "9900", "B8R", "B11R"],
  MAN: ["Lion's Coach", "Lion's City", "Lion's Intercity"],
  Scania: ["Touring", "Interlink", "Citywide"],
  Iveco: ["Crossway", "Magelys", "Daily Minibus"],
  Isuzu: ["Novociti", "Citiport"],
  Yutong: ["ZK6122", "E12", "ICe12"],
  "King Long": ["XMQ6127", "XMQ6800"],
  "Golden Dragon": ["XML6125", "XML6907"],
  Zhongtong: ["LCK6127", "LCK6117"],
  Higer: ["KLQ6122", "KLQ6109"],
  Sunwin: ["SWB6121", "SWB6180"],
  Volkswagen: ["Comil", "Neobus Thunder+"],
  [OTHER]: [],
};

const CARAVAN_MODELS: Record<string, string[]> = {
  Adria: ["Adora", "Altea", "Astella", "Matrix"],
  Weinsberg: ["CaraOne", "CaraCompact", "CaraBus"],
  Swift: ["Challenger", "Sprite", "Basecamp"],
  Coachman: ["Pastiche", "VIP", "Vision"],
  Hobby: ["De Luxe", "Premium", "Prestige"],
  Dethleffs: ["Camper", "Globebus", "Trend"],
  LMC: ["Style", "Vivo", "Musica"],
  Knaus: ["Sport", "Sudwind", "Van TI"],
  Sterckeman: ["Starlett", "Evolution"],
  Burstner: ["Averso", "Premio", "Solano"],
  Hymer: ["Eriba Touring", "B-Class", "ML-T"],
  Fendt: ["Bianco", "Saphir", "Tendenza"],
  Chausson: ["Welcome", "Titanium", "X-Line"],
  Rapido: ["Serie 9", "Distinction"],
  Carado: ["T-Series", "A-Series"],
  Eriba: ["Touring", "Nova"],
  Tabbert: ["Da Vinci", "Rossini"],
  Kabe: ["Royal", "Classic", "Imperial"],
  Bailey: ["Pursuit", "Unicorn", "Phoenix"],
  [OTHER]: [],
};

const JET_SKI_MODELS: Record<string, string[]> = {
  "Sea-Doo": ["Spark", "GTI", "GTX", "RXP-X", "Fish Pro"],
  Yamaha: ["WaveRunner VX", "WaveRunner FX", "GP1800", "SuperJet"],
  Kawasaki: ["Jet Ski STX", "Jet Ski Ultra 310", "SX-R"],
  Honda: ["AquaTrax"],
  Polaris: ["SLH", "SL 780"],
  Taiga: ["Orca", "Ekko"],
  [OTHER]: [],
};

const ATV_MODELS: Record<string, string[]> = {
  CFMOTO: ["CForce 450", "CForce 800", "ZForce 800"],
  "Can-Am": ["Outlander", "Renegade", "Maverick"],
  Polaris: ["Sportsman", "RZR", "Ranger"],
  Yamaha: ["Grizzly", "Kodiak", "Raptor"],
  Honda: ["Rancher", "Foreman", "Rubicon"],
  Suzuki: ["KingQuad"],
  Kawasaki: ["Brute Force", "KFX"],
  Segway: ["Snarler AT6", "Fugleman UT10"],
  [OTHER]: [],
};

const BOAT_MODELS: Record<string, string[]> = {
  Quicksilver: ["Activ 675", "Arvor 645"],
  Bayliner: ["Element", "VR5", "Trophy"],
  Yamaha: ["FR24", "AR195"],
  "Boston Whaler": ["Dauntless", "Montauk"],
  Zodiac: ["Medline", "Open"],
  Selva: ["Marlin", "D52"],
  Ranieri: ["Voyager", "Next"],
  [OTHER]: [],
};

const MAKES_BY_TYPE: Record<VehicleType, Record<string, string[]>> = {
  car: CAR_MODELS,
  motorcycle: MOTORCYCLE_MODELS,
  scooter: SCOOTER_MODELS,
  truck: TRUCK_MODELS,
  bus: BUS_MODELS,
  caravan: CARAVAN_MODELS,
  jet_ski: JET_SKI_MODELS,
  atv: ATV_MODELS,
  boat: BOAT_MODELS,
};

export function getMakes(type: VehicleType): string[] {
  const makes = Object.keys(MAKES_BY_TYPE[type] ?? {}).filter((m) => m !== OTHER);
  return [...makes.sort((a, b) => a.localeCompare(b)), OTHER];
}

export function getModels(type: VehicleType, make: string): string[] {
  const models = MAKES_BY_TYPE[type]?.[make] ?? [];
  return [...models, OTHER];
}
