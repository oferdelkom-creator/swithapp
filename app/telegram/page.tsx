import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TelegramPilot, { type TelegramCar } from "./TelegramPilot";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ market?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const isIsrael = params.market?.toUpperCase() === "IL";
  return {
    title: isIsrael ? "SwitchApp ישראל בטלגרם" : "SwitchApp в Telegram",
    description: isIsrael ? "מציאת הרכב הבא בהחלקה בתוך Telegram." : "Подбор автомобиля свайпами внутри Telegram.",
  };
}

const RU_FALLBACK_CARS: TelegramCar[] = [
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

const IL_FALLBACK_CARS: TelegramCar[] = [
  { car_id: "il-demo-1", make: "Toyota", model: "Corolla Cross", year: 2023, price: 118000, photo_urls: ["/campaign/dealer-choice.webp"], seller_name: "בעלים פרטיים", currency: "ILS", latitude: 32.0853, longitude: 34.7818 },
  { car_id: "il-demo-2", make: "Hyundai", model: "Ioniq 5", year: 2022, price: 142000, photo_urls: ["/einav-luxury/electric.webp"], seller_name: "בעלים פרטיים", currency: "ILS", latitude: 31.7683, longitude: 35.2137 },
  { car_id: "il-demo-3", make: "Kia", model: "Niro", year: 2021, price: 98000, photo_urls: ["/einav-luxury/suv.webp"], seller_name: "SwitchApp Partner", currency: "ILS", latitude: 32.794, longitude: 34.9896 },
];

export default async function TelegramPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const params = await searchParams;
  const market = params.market?.toUpperCase() === "IL" ? "IL" : "RU";
  const supabase = await createClient();
  const { data } = await supabase.rpc("market_inventory_for_country", {
    p_market_country: market,
    p_limit: 24,
  });

  const liveCars = ((data ?? []) as TelegramCar[])
    .filter((car) => car.car_id && car.make && car.model)
    .map((car) => ({ ...car, currency: market === "IL" ? "ILS" as const : "RUB" as const }))
    .slice(0, 24);

  return <TelegramPilot initialCars={liveCars.length ? liveCars : market === "IL" ? IL_FALLBACK_CARS : RU_FALLBACK_CARS} initialMarket={market} />;
}
