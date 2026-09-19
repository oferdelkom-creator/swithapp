export const TELEGRAM_PRODUCTS = {
  buyer_plus_30d: {
    title: "SwitchApp Buyer Plus — 30 дней",
    description: "Ранние уведомления, расширенные фильтры и история свайпов на 30 дней.",
    stars: 300,
  },
  dealer_pro_30d: {
    title: "SwitchApp Dealer Pro — 30 дней",
    description: "Профессиональный кабинет дилера и инструменты для работы с лидами.",
    stars: 1000,
  },
} as const;

export type TelegramProductId = keyof typeof TELEGRAM_PRODUCTS;

export function isTelegramProductId(value: string): value is TelegramProductId {
  return value in TELEGRAM_PRODUCTS;
}
