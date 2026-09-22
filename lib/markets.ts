export type MarketCode = "IL" | "FR";
export type CurrencyCode = "ILS" | "EUR";
export type BusinessKind =
  | "private_seller"
  | "small_dealer"
  | "dealership"
  | "official_importer"
  | "parallel_importer"
  | "leasing_company"
  | "rental_company";

export interface MarketConfig {
  code: MarketCode;
  country: string;
  locale: string;
  currency: CurrencyCode;
  currencyLocale: string;
  phoneCountryCode: string;
  launchState: "live" | "prelaunch";
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  IL: {
    code: "IL",
    country: "Israel",
    locale: "he",
    currency: "ILS",
    currencyLocale: "he-IL",
    phoneCountryCode: "+972",
    launchState: "live",
  },
  FR: {
    code: "FR",
    country: "France",
    locale: "fr",
    currency: "EUR",
    currencyLocale: "fr-FR",
    phoneCountryCode: "+33",
    launchState: "prelaunch",
  },
};

export const EUROPE_PARTICIPANTS: {
  kind: BusinessKind;
  role: "private" | "dealer" | "importer";
  titleFr: string;
  descriptionFr: string;
}[] = [
  { kind: "private_seller", role: "private", titleFr: "Particuliers", descriptionFr: "Publier, vendre, acheter ou proposer un échange." },
  { kind: "small_dealer", role: "dealer", titleFr: "Marchands indépendants", descriptionFr: "Une vitrine simple, un stock limité et des contacts directs." },
  { kind: "dealership", role: "dealer", titleFr: "Concessions et groupes", descriptionFr: "Import de stock, équipes, vitrines et gestion des demandes." },
  { kind: "official_importer", role: "importer", titleFr: "Importateurs officiels", descriptionFr: "Catalogues neufs, réseaux, offres et disponibilités." },
  { kind: "parallel_importer", role: "importer", titleFr: "Importateurs parallèles", descriptionFr: "Origine, disponibilité, configuration et prix transparents." },
  { kind: "leasing_company", role: "dealer", titleFr: "Sociétés de leasing", descriptionFr: "Véhicules récents, retours de flotte et offres professionnelles." },
  { kind: "rental_company", role: "dealer", titleFr: "Loueurs", descriptionFr: "Renouvellement de flotte et vente de véhicules d’occasion." },
];

export function formatMarketMoney(value: number, market: MarketCode) {
  const config = MARKETS[market];
  return new Intl.NumberFormat(config.currencyLocale, {
    style: "currency",
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(value);
}
