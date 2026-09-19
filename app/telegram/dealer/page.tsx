import type { Metadata } from "next";
import TelegramDealerPortal from "./TelegramDealerPortal";

export const metadata: Metadata = {
  title: "SwitchApp для дилеров и импортёров",
  description: "Управление автомобилями и заявками в Telegram.",
};

export default function TelegramDealerPage() {
  return <TelegramDealerPortal />;
}


