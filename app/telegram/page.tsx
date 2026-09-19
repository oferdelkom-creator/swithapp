import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TelegramPilot, { type TelegramCar } from "./TelegramPilot";

export const metadata: Metadata = {
  title: "SwitchApp в Telegram",
  description: "Подбор автомобиля свайпами внутри Telegram.",
};

const PILOT_MARKET = "RU" as const;

const FALLBACK_CARS: TelegramCar[] = [
  {
    car_id: "demo-1",
    make: "Toyota",
    model: "RAV4",
    year: 2022,
    price: 2_950_000,
    photo_urls: ["/campaign/dealer-choice.webp"],
    seller_name: "SwitchApp Partner",
    currency: "RUB",
    latitude: 55.7558,
    longitude: 37.6173,
  },
  {
    car_id: "demo-2",
    make: "BMW",
    model: "X3",
    year: 2021,
    price: 4_350_000,
    photo_urls: ["/einav-luxury/suv.webp"],
    seller_name: "SwitchApp Partner",
    currency: "RUB",
    latitude: 55.7812,
    longitude: 37.5987,
  },
  {
    car_id: "demo-3",
    make: "Tesla",
    model: "Model 3",
    year: 2023,
    price: 3_890_000,
    photo_urls: ["/einav-luxury/electric.webp"],
    seller_name: "SwitchApp Partner",
    currency: "RUB",
    latitude: 55.7299,
    longitude: 37.6388,
  },
];

export default async function TelegramPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("market_inventory_for_country", {
    p_market_country: PILOT_MARKET,
    p_limit: 24,
  });

  const liveCars = ((data ?? []) as TelegramCar[])
    .filter((car) => car.car_id && car.make && car.model)
    .map((car) => ({ ...car, currency: "RUB" as const }))
    .slice(0, 24);

  return <TelegramPilot initialCars={liveCars.length ? liveCars : FALLBACK_CARS} />;
}
