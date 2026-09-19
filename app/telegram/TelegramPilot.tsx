"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

export interface TelegramCar {
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  price: number | null;
  photo_urls: string[];
  seller_name: string;
  currency?: "ILS" | "RUB";
  latitude?: number | null;
  longitude?: number | null;
}

interface TelegramUser {
  id: number;
  first_name: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TelegramUser; start_param?: string };
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  isVersionAtLeast?(version: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  LocationManager?: {
    isInited: boolean;
    isLocationAvailable: boolean;
    isAccessGranted: boolean;
    init(callback?: () => void): void;
    getLocation(callback: (location: TelegramLocation | null) => void): void;
    openSettings(): void;
  };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "success" | "warning" | "error"): void;
  };
}

interface TelegramLocation {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number | null;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

type Stage = "welcome" | "preferences" | "deck" | "saved" | "vehicle-check";

const CITIES = ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"];
const BUDGETS = ["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"];
const PILOT_MARKET = "RU";
const STORAGE_KEY = `switchapp-telegram-pilot:${PILOT_MARKET}`;
const CITY_COORDINATES: Record<string, [number, number]> = {
  "Москва": [55.7558, 37.6173],
  "Санкт-Петербург": [59.9343, 30.3351],
  "Казань": [55.7961, 49.1064],
  "Екатеринбург": [56.8389, 60.6057],
  "Новосибирск": [55.0084, 82.9357],
};
const SEARCH_RADII = [25, 50, 100, 250];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestCity(latitude: number, longitude: number) {
  return Object.entries(CITY_COORDINATES).sort(([, a], [, b]) =>
    distanceKm(latitude, longitude, a[0], a[1]) - distanceKm(latitude, longitude, b[0], b[1])
  )[0]?.[0] ?? "Москва";
}

function formatPrice(price: number | null) {
  if (!price) return "Цена по запросу";
  return new Intl.NumberFormat("ru-RU").format(price);
}

function displayPrice(car: TelegramCar) {
  if (!car.price) return "Цена по запросу";
  return `${formatPrice(car.price)} ${car.currency === "RUB" ? "₽" : "₪"}`;
}

export default function TelegramPilot({ initialCars }: { initialCars: TelegramCar[] }) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [telegramInitData, setTelegramInitData] = useState("");
  const [founderNumber, setFounderNumber] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [city, setCity] = useState("Москва");
  const [budget, setBudget] = useState(BUDGETS[2]);
  const [defaultSalePrice, setDefaultSalePrice] = useState("");
  const [location, setLocation] = useState<TelegramLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [radiusKm, setRadiusKm] = useState(50);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<TelegramCar[]>([]);
  const [dragX, setDragX] = useState(0);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleCheckError, setVehicleCheckError] = useState<string | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { city?: string; budget?: string; defaultSalePrice?: string; radiusKm?: number; savedIds?: string[] };
      const restore = window.setTimeout(() => {
        if (parsed.city) setCity(parsed.city);
        if (parsed.budget) setBudget(parsed.budget);
        if (parsed.defaultSalePrice) setDefaultSalePrice(parsed.defaultSalePrice);
        if (parsed.radiusKm && SEARCH_RADII.includes(parsed.radiusKm)) setRadiusKm(parsed.radiusKm);
        if (parsed.savedIds?.length) {
          setSaved(initialCars.filter((car) => parsed.savedIds?.includes(car.car_id)));
        }
      }, 0);
      return () => window.clearTimeout(restore);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [initialCars]);

  const deckCars = useMemo(() => {
    if (!location) return initialCars;
    return initialCars.filter((car) => car.latitude != null && car.longitude != null &&
      distanceKm(location.latitude, location.longitude, car.latitude, car.longitude) <= radiusKm);
  }, [initialCars, location, radiusKm]);
  const current = deckCars[index];
  const progress = deckCars.length ? Math.min(100, ((index + 1) / deckCars.length) * 100) : 0;
  const displayName = telegramUser?.first_name || "друг";

  const persist = (nextSaved: TelegramCar[]) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ city, budget, defaultSalePrice, radiusKm, savedIds: nextSaved.map((car) => car.car_id) })
    );
  };

  const syncTelegramProfile = async (nextSaved: TelegramCar[], moveToDeck = false) => {
    persist(nextSaved);
    if (!telegramInitData) {
      if (moveToDeck) setStage("deck");
      return;
    }

    setRegistering(true);
    setRegistrationError(null);
    try {
      const response = await fetch("/api/telegram/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData: telegramInitData,
          marketCountry: PILOT_MARKET,
          city,
          budget,
          defaultSalePrice: Number(defaultSalePrice),
          latitude: location ? Number(location.latitude.toFixed(3)) : null,
          longitude: location ? Number(location.longitude.toFixed(3)) : null,
          locationAccuracyM: location?.horizontal_accuracy ?? null,
          radiusKm,
          savedCarIds: nextSaved.map((car) => car.car_id),
        }),
      });
      if (!response.ok) throw new Error("registration_failed");
      const result = (await response.json()) as { founderNumber: number | null };
      setFounderNumber(result.founderNumber);
      if (moveToDeck) {
        const telegramApp = window.Telegram?.WebApp;
        if (telegramApp?.isVersionAtLeast?.("6.1")) {
          telegramApp.HapticFeedback?.notificationOccurred("success");
        }
        setStage("deck");
      }
    } catch {
      setRegistrationError("Не удалось сохранить место. Попробуйте ещё раз.");
    } finally {
      setRegistering(false);
    }
  };

  const ownCarPrice = Number(defaultSalePrice);
  const priceDifference = current?.price != null && Number.isFinite(ownCarPrice) && ownCarPrice > 0
    ? current.price - ownCarPrice
    : null;

  const requestLocation = () => {
    const manager = window.Telegram?.WebApp.LocationManager;
    if (!manager || !window.Telegram?.WebApp.isVersionAtLeast?.("8.0")) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("requesting");
    manager.init(() => {
      if (!manager.isLocationAvailable) {
        setLocationStatus("denied");
        return;
      }
      manager.getLocation((nextLocation) => {
        if (!nextLocation) {
          setLocationStatus("denied");
          return;
        }
        setLocation(nextLocation);
        setCity(nearestCity(nextLocation.latitude, nextLocation.longitude));
        setIndex(0);
        setLocationStatus("granted");
      });
    });
  };

  const openOfficialVehicleCheck = () => {
    const vin = vehicleVin.trim().toUpperCase();
    const plate = vehiclePlate.trim().toUpperCase().replace(/\s+/g, "");
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      setVehicleCheckError("VIN должен содержать 17 символов без I, O и Q.");
      return;
    }
    if (plate && !/^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/.test(plate)) {
      setVehicleCheckError("Проверьте формат госномера, например А123ВС77.");
      return;
    }
    if (!vin) {
      setVehicleCheckError("Для официальной проверки добавьте VIN. По одному госномеру полной выписки нет.");
      return;
    }
    setVehicleCheckError(null);
    window.open(`https://госавтоинспекция.рф/check/auto#${encodeURIComponent(vin)}`, "_blank", "noopener,noreferrer");
  };

  const choose = (liked: boolean) => {
    if (!current) return;
    const nextSaved = liked && !saved.some((car) => car.car_id === current.car_id)
      ? [...saved, current]
      : saved;
    setSaved(nextSaved);
    if (liked) void syncTelegramProfile(nextSaved);
    const telegramApp = window.Telegram?.WebApp;
    if (telegramApp?.isVersionAtLeast?.("6.1")) {
      telegramApp.HapticFeedback?.impactOccurred(liked ? "medium" : "light");
    }
    setDragX(liked ? 520 : -520);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDragX(0);
    }, 180);
  };

  const setupTelegram = () => {
    const app = window.Telegram?.WebApp;
    if (!app) return;
    app.ready();
    app.expand();
    if (app.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.("#070b18");
    app.setBackgroundColor?.("#070b18");
    }
    setTelegramUser(app.initDataUnsafe?.user ?? null);
    setTelegramInitData(app.initData ?? "");
  };

  const cardsBehind = useMemo(() => deckCars.slice(index + 1, index + 3), [deckCars, index]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js?63"
        strategy="afterInteractive"
        onLoad={setupTelegram}
      />
      <div className="telegram-app min-h-[100dvh] bg-[#070b18] text-white" lang="ru" dir="ltr">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-black tracking-tight">SWITCH<span className="text-[#ff4f70]">APP</span></div>
              <div className="text-[11px] text-white/50">Автомобили находят вас</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStage("vehicle-check")} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Проверка авто</button>
              <button type="button" onClick={() => setStage("saved")} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">
                {founderNumber ? `#${founderNumber} · ` : ""}♥ {saved.length}
              </button>
            </div>
          </header>

          {stage === "welcome" && (
            <section className="flex flex-1 flex-col justify-center py-8">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#ff4f70]/30 bg-[#ff4f70]/10 px-3 py-1.5 text-xs font-semibold text-[#ff91a6]">
                FOUNDING 1000 · БЕСПЛАТНО
              </div>
              <h1 className="text-4xl font-black leading-[1.05] tracking-tight">
                Ваш следующий автомобиль — одним свайпом.
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-white/65">
                Добро пожаловать, {displayName}. Укажите, что вы ищете, и SwitchApp соберёт персональную ленту автомобилей.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs text-white/55">
                {[["01", "Настройте"], ["02", "Свайпайте"], ["03", "Свяжитесь"]].map(([n, label]) => (
                  <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="mb-1 text-lg font-black text-white">{n}</div>{label}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStage("preferences")}
                className="mt-8 rounded-2xl bg-[#ff4f70] px-5 py-4 text-base font-black shadow-[0_18px_50px_rgba(255,79,112,0.28)]"
              >
                Получить ранний доступ
              </button>
              <p className="mt-3 text-center text-[11px] text-white/35">Без карты · без автоматического списания</p>
            </section>
          )}

          {stage === "preferences" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-4 pb-2">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff91a6]">Шаг 1 из 2</div>
              <h1 className="mt-2 text-3xl font-black">Что вам подходит?</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">Два ответа — и можно начинать.</p>

              <label className="mt-8 text-sm font-bold">Ваш город</label>
              <button type="button" onClick={requestLocation} disabled={locationStatus === "requesting"} className="mt-3 rounded-2xl border border-[#ff4f70]/35 bg-[#ff4f70]/10 px-4 py-3 text-left text-sm font-bold text-[#ffb0bf] disabled:opacity-60">
                {locationStatus === "requesting" ? "Определяем местоположение…" : locationStatus === "granted" ? `✓ Геолокация включена · ${city}` : "⌖ Определить автоматически"}
              </button>
              {locationStatus === "denied" ? <p className="mt-2 text-xs text-white/45">Нет доступа к геолокации. Выберите город вручную.</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {CITIES.map((item) => (
                  <button key={item} type="button" onClick={() => setCity(item)} className={`rounded-full px-4 py-2 text-sm ${city === item ? "bg-white text-[#070b18]" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item}
                  </button>
                ))}
              </div>

              <label className="mt-6 text-sm font-bold">Радиус поиска</label>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {SEARCH_RADII.map((item) => (
                  <button key={item} type="button" onClick={() => { setRadiusKm(item); setIndex(0); }} className={`rounded-xl px-2 py-2.5 text-xs font-semibold ${radiusKm === item ? "bg-white text-[#070b18]" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item} км
                  </button>
                ))}
              </div>

              <label className="mt-7 text-sm font-bold">Бюджет</label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {BUDGETS.map((item) => (
                  <button key={item} type="button" onClick={() => setBudget(item)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${budget === item ? "bg-[#ff4f70] text-white" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item}
                  </button>
                ))}
              </div>

              <label className="mt-6 text-sm font-bold" htmlFor="default-sale-price">Цена продажи вашего автомобиля</label>
              <div className="relative mt-3">
                <input
                  id="default-sale-price"
                  required
                  type="number"
                  inputMode="numeric"
                  min="10000"
                  max="1000000000"
                  step="10000"
                  value={defaultSalePrice}
                  onChange={(event) => setDefaultSalePrice(event.target.value)}
                  placeholder="Например, 1 800 000"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white outline-none focus:border-[#ff4f70]/60"
                />
                <span className="absolute right-4 top-3 text-white/45">₽</span>
              </div>
              <p className="mt-2 text-xs text-white/40">Эта цена будет использоваться по умолчанию для расчёта доплаты.</p>

              <button
                type="button"
                onClick={() => void syncTelegramProfile(saved, true)}
                disabled={registering || !Number.isFinite(ownCarPrice) || ownCarPrice < 10000}
                className="mt-auto rounded-2xl bg-white px-5 py-4 text-base font-black text-[#070b18] disabled:opacity-60"
              >
                {registering ? "Сохраняем место…" : "Показать автомобили"}
              </button>
              {registrationError ? <p className="mt-3 text-center text-xs text-red-300">{registrationError}</p> : null}
            </section>
          )}

          {stage === "deck" && (
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-white/45">
                  <span>{city} · {budget}</span>
                  <span>{Math.min(index + 1, deckCars.length)}/{deckCars.length}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff4f70] transition-all" style={{ width: `${progress}%` }} /></div>
              </div>

              {current ? (
                <div className="relative min-h-0 flex-1">
                  {cardsBehind.map((car, offset) => (
                    <div key={car.car_id} className="absolute inset-x-3 bottom-2 top-2 rounded-[30px] border border-white/10 bg-[#121827]" style={{ transform: `scale(${0.96 - offset * 0.02}) translateY(${10 + offset * 7}px)` }} />
                  ))}
                  <article
                    className="absolute inset-0 overflow-hidden rounded-[30px] border border-white/10 bg-[#121827] shadow-2xl transition-transform duration-200"
                    style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, touchAction: "none" }}
                    onPointerDown={(event) => { startX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => { if (startX.current !== null) setDragX(event.clientX - startX.current); }}
                    onPointerUp={() => {
                      const finalX = dragX;
                      startX.current = null;
                      if (finalX > 90) choose(true);
                      else if (finalX < -90) choose(false);
                      else setDragX(0);
                    }}
                  >
                    <div className="relative h-[63%] min-h-64 bg-gradient-to-br from-slate-700 to-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element -- listing hosts are user-controlled; the existing marketplace uses the same safe URL list. */}
                      <img src={current.photo_urls?.[0] || "/campaign/dealer-choice.webp"} alt={`${current.make} ${current.model}`} className="h-full w-full object-cover" draggable={false} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#121827] via-transparent to-black/10" />
                      <div className={`absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black text-emerald-400 transition-opacity ${dragX > 30 ? "opacity-100" : "opacity-0"}`}>БЕРУ</div>
                      <div className={`absolute right-5 top-6 rotate-12 rounded-lg border-4 border-white/70 px-3 py-1 text-2xl font-black text-white/80 transition-opacity ${dragX < -30 ? "opacity-100" : "opacity-0"}`}>ДАЛЬШЕ</div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div><h2 className="text-2xl font-black">{current.make} {current.model}</h2><p className="mt-1 text-sm text-white/50">{current.year || "Год не указан"} · {current.seller_name}</p></div>
                        <div className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold">ПРОВЕРЕНО</div>
                      </div>
                      <div className="mt-4 text-xl font-black text-[#ff91a6]">{displayPrice(current)}</div>
                      {priceDifference != null ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" aria-live="polite">
                          {priceDifference === 0 ? (
                            <span className="font-bold text-emerald-300">Обмен без доплаты</span>
                          ) : priceDifference > 0 ? (
                            <><span className="text-white/55">Вы доплачиваете </span><span className="font-black text-amber-300">{formatPrice(priceDifference)} ₽</span></>
                          ) : (
                            <><span className="text-white/55">Вам доплачивают </span><span className="font-black text-emerald-300">{formatPrice(Math.abs(priceDifference))} ₽</span></>
                          )}
                        </div>
                      ) : <div className="mt-3 text-xs text-white/40">Нет цены — расчёт доплаты недоступен.</div>}
                    </div>
                  </article>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="text-5xl">✓</div><h2 className="mt-4 text-2xl font-black">Вы просмотрели всё</h2><p className="mt-2 text-sm text-white/55">Мы сообщим, когда появятся новые варианты.</p>
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-5">
                <button type="button" onClick={() => choose(false)} disabled={!current} aria-label="Пропустить" className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/5 text-2xl disabled:opacity-30">×</button>
                <button type="button" onClick={() => setStage("saved")} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-lg">☰</button>
                <button type="button" onClick={() => choose(true)} disabled={!current} aria-label="Сохранить" className="grid h-14 w-14 place-items-center rounded-full bg-[#ff4f70] text-2xl shadow-[0_12px_35px_rgba(255,79,112,0.32)] disabled:opacity-30">♥</button>
              </div>
            </section>
          )}

          {stage === "saved" && (
            <section className="flex flex-1 flex-col">
              <button type="button" onClick={() => setStage(index ? "deck" : "welcome")} className="mb-5 w-fit text-sm text-white/55">← Назад</button>
              <h1 className="text-3xl font-black">Избранное</h1>
              <p className="mt-2 text-sm text-white/50">Автомобили, которые вы отметили свайпом вправо.</p>
              <div className="mt-6 space-y-3">
                {saved.length ? saved.map((car) => (
                  <div key={car.car_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- see listing image note above. */}
                    <img src={car.photo_urls?.[0] || "/campaign/dealer-choice.webp"} alt="" className="h-16 w-20 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1"><div className="truncate font-bold">{car.make} {car.model}</div><div className="mt-1 text-xs text-white/45">{displayPrice(car)}</div></div>
                    <span className="text-[#ff91a6]">♥</span>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">Пока пусто — свайпните понравившийся автомобиль вправо.</div>}
              </div>
            </section>
          )}

          {stage === "vehicle-check" && (
            <section className="flex flex-1 flex-col">
              <button type="button" onClick={() => setStage("welcome")} className="mb-5 w-fit text-sm text-white/55">← Назад</button>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff91a6]">Проверка перед покупкой</div>
              <h1 className="mt-2 text-3xl font-black">Проверьте автомобиль</h1>
              <p className="mt-3 text-sm leading-6 text-white/55">Введите госномер и VIN. Официальная проверка откроется на сайте Госавтоинспекции России.</p>
              <label className="mt-7 text-sm font-bold" htmlFor="ru-plate">Госномер</label>
              <input id="ru-plate" value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} placeholder="А123ВС77" autoCapitalize="characters" className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ff4f70]/60" />
              <label className="mt-5 text-sm font-bold" htmlFor="ru-vin">VIN</label>
              <input id="ru-vin" value={vehicleVin} onChange={(event) => setVehicleVin(event.target.value)} placeholder="17 символов" autoCapitalize="characters" className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white outline-none focus:border-[#ff4f70]/60" />
              <button type="button" onClick={openOfficialVehicleCheck} className="mt-6 rounded-2xl bg-white px-5 py-4 text-base font-black text-[#070b18]">Открыть официальную проверку</button>
              {vehicleCheckError ? <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{vehicleCheckError}</p> : null}
              <p className="mt-5 text-xs leading-5 text-white/35">Мы не сохраняем VIN или номер автомобиля на этом этапе. Для автоматического отчёта по госномеру потребуется договор с лицензированным поставщиком данных.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
