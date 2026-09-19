"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

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
  openInvoice?(url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void): void;
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

interface PlateLookupResult {
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  fuel_type: string | null;
  provider: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

type Stage = "welcome" | "preferences" | "access" | "deck" | "saved" | "sell" | "vehicle-check";

const MARKET_OPTIONS = {
  RU: {
    cities: ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"],
    budgets: ["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"],
    coordinates: { "Москва": [55.7558, 37.6173], "Санкт-Петербург": [59.9343, 30.3351], "Казань": [55.7961, 49.1064], "Екатеринбург": [56.8389, 60.6057], "Новосибирск": [55.0084, 82.9357] },
  },
  IL: {
    cities: ["תל אביב", "ירושלים", "חיפה", "באר שבע", "ראשון לציון"],
    budgets: ["עד 60,000 ₪", "60–100 אלף ₪", "100–160 אלף ₪", "מעל 160 אלף ₪"],
    coordinates: { "תל אביב": [32.0853, 34.7818], "ירושלים": [31.7683, 35.2137], "חיפה": [32.794, 34.9896], "באר שבע": [31.252, 34.7915], "ראשון לציון": [31.973, 34.7925] },
  },
};
const SEARCH_RADII = [25, 50, 100, 250];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestCity(latitude: number, longitude: number, coordinates: Record<string, number[]>, fallback: string) {
  return Object.entries(coordinates).sort(([, a], [, b]) =>
    distanceKm(latitude, longitude, a[0], a[1]) - distanceKm(latitude, longitude, b[0], b[1])
  )[0]?.[0] ?? fallback;
}

function formatPrice(price: number | null, isIsrael = false) {
  if (!price) return isIsrael ? "מחיר לפי בקשה" : "Цена по запросу";
  return new Intl.NumberFormat(isIsrael ? "he-IL" : "ru-RU").format(price);
}

function displayPrice(car: TelegramCar, isIsrael = false) {
  if (!car.price) return isIsrael ? "מחיר לפי בקשה" : "Цена по запросу";
  return `${formatPrice(car.price, isIsrael)} ${car.currency === "RUB" ? "₽" : "₪"}`;
}

export default function TelegramPilot({ initialCars, initialMarket }: { initialCars: TelegramCar[]; initialMarket: "IL" | "RU" }) {
  const router = useRouter();
  const isIsrael = initialMarket === "IL";
  const marketOptions = MARKET_OPTIONS[initialMarket];
  const storageKey = `switchapp-telegram-pilot:${initialMarket}`;
  const [stage, setStage] = useState<Stage>("welcome");
  const [profileStep, setProfileStep] = useState<1 | 2 | 3>(1);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [telegramInitData, setTelegramInitData] = useState("");
  const [founderNumber, setFounderNumber] = useState<number | null>(null);
  const [hasBuyerAccess, setHasBuyerAccess] = useState(false);
  const [buying, setBuying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [listingMake, setListingMake] = useState("");
  const [listingModel, setListingModel] = useState("");
  const [listingYear, setListingYear] = useState(String(new Date().getFullYear()));
  const [listingPrice, setListingPrice] = useState("");
  const [listingPhotoUrl, setListingPhotoUrl] = useState("");
  const [uploadingListingPhoto, setUploadingListingPhoto] = useState(false);
  const [publishingListing, setPublishingListing] = useState(false);
  const [listingMessage, setListingMessage] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [primaryPlate, setPrimaryPlate] = useState("");
  const [primaryMake, setPrimaryMake] = useState("");
  const [primaryModel, setPrimaryModel] = useState("");
  const [primaryYear, setPrimaryYear] = useState(String(new Date().getFullYear()));
  const [primaryMileage, setPrimaryMileage] = useState("");
  const [primaryHand, setPrimaryHand] = useState("1");
  const [primaryPhotoUrl, setPrimaryPhotoUrl] = useState("");
  const [primaryPhotoUrls, setPrimaryPhotoUrls] = useState<string[]>([]);
  const [uploadingPrimaryPhotos, setUploadingPrimaryPhotos] = useState(false);
  const [primaryPhotoError, setPrimaryPhotoError] = useState<string | null>(null);
  const [city, setCity] = useState(marketOptions.cities[0]);
  const [budget, setBudget] = useState(marketOptions.budgets[2]);
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
  const [plateLookupResult, setPlateLookupResult] = useState<PlateLookupResult | null>(null);
  const [checkingPlate, setCheckingPlate] = useState(false);
  const [checkingPrimaryPlate, setCheckingPrimaryPlate] = useState(false);
  const [primaryLookupMessage, setPrimaryLookupMessage] = useState<string | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { city?: string; budget?: string; defaultSalePrice?: string; radiusKm?: number; savedIds?: string[]; primaryPlate?: string; primaryMake?: string; primaryModel?: string; primaryYear?: string; primaryMileage?: string; primaryHand?: string; primaryPhotoUrl?: string; primaryPhotoUrls?: string[] };
      const restore = window.setTimeout(() => {
        if (parsed.city) setCity(parsed.city);
        if (parsed.budget) setBudget(parsed.budget);
        if (parsed.defaultSalePrice) setDefaultSalePrice(parsed.defaultSalePrice);
        if (parsed.primaryPlate) setPrimaryPlate(parsed.primaryPlate);
        if (parsed.primaryMake) setPrimaryMake(parsed.primaryMake);
        if (parsed.primaryModel) setPrimaryModel(parsed.primaryModel);
        if (parsed.primaryYear) setPrimaryYear(parsed.primaryYear);
        if (parsed.primaryMileage) setPrimaryMileage(parsed.primaryMileage);
        if (parsed.primaryHand) setPrimaryHand(parsed.primaryHand);
        if (parsed.primaryPhotoUrl) setPrimaryPhotoUrl(parsed.primaryPhotoUrl);
        if (parsed.primaryPhotoUrls?.length) setPrimaryPhotoUrls(parsed.primaryPhotoUrls.slice(0, 6));
        if (parsed.radiusKm && SEARCH_RADII.includes(parsed.radiusKm)) setRadiusKm(parsed.radiusKm);
        if (parsed.savedIds?.length) {
          setSaved(initialCars.filter((car) => parsed.savedIds?.includes(car.car_id)));
        }
      }, 0);
      return () => window.clearTimeout(restore);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [initialCars, storageKey]);

  const deckCars = useMemo(() => {
    if (!location) return initialCars;
    return initialCars.filter((car) => car.latitude != null && car.longitude != null &&
      distanceKm(location.latitude, location.longitude, car.latitude, car.longitude) <= radiusKm);
  }, [initialCars, location, radiusKm]);
  const current = deckCars[index];
  const progress = deckCars.length ? Math.min(100, ((index + 1) / deckCars.length) * 100) : 0;
  const displayName = telegramUser?.first_name || (isIsrael ? "חבר" : "друг");

  const persist = (nextSaved: TelegramCar[]) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ city, budget, defaultSalePrice, radiusKm, primaryPlate, primaryMake, primaryModel, primaryYear, primaryMileage, primaryHand, primaryPhotoUrl, primaryPhotoUrls, savedIds: nextSaved.map((car) => car.car_id) })
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
          marketCountry: initialMarket,
          city,
          budget,
          defaultSalePrice: Number(defaultSalePrice),
          latitude: location ? Number(location.latitude.toFixed(3)) : null,
          longitude: location ? Number(location.longitude.toFixed(3)) : null,
          locationAccuracyM: location?.horizontal_accuracy ?? null,
          radiusKm,
          savedCarIds: nextSaved.map((car) => car.car_id),
          vehicle: {
            plate: primaryPlate,
            make: primaryMake,
            model: primaryModel,
            year: Number(primaryYear),
            mileage: Number(primaryMileage),
            hand: Number(primaryHand),
            photoUrl: primaryPhotoUrls[0] || primaryPhotoUrl || undefined,
            photoUrls: primaryPhotoUrls.length ? primaryPhotoUrls : undefined,
          },
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { code?: string } | null;
        throw new Error(failure?.code || `registration_failed_${response.status}`);
      }
      const result = (await response.json()) as { founderNumber: number | null; hasBuyerAccess: boolean };
      setFounderNumber(result.founderNumber);
      setHasBuyerAccess(result.hasBuyerAccess);
      if (moveToDeck) {
        const telegramApp = window.Telegram?.WebApp;
        if (telegramApp?.isVersionAtLeast?.("6.1")) {
          telegramApp.HapticFeedback?.notificationOccurred("success");
        }
        setStage("deck");
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "registration_failed";
      const supportCode = code.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
      setRegistrationError(isIsrael
        ? `לא הצלחנו לשמור. קוד תקלה: ${supportCode}`
        : `Не удалось сохранить. Код ошибки: ${supportCode}`);
    } finally {
      setRegistering(false);
    }
  };

  const buyBuyerAccess = async () => {
    if (!telegramInitData) {
      setPaymentError(isIsrael ? "התשלום זמין רק בתוך Telegram." : "Оплата доступна только внутри Telegram.");
      return;
    }
    setBuying(true);
    setPaymentError(null);
    try {
      const response = await fetch("/api/telegram/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: telegramInitData, productId: "buyer_plus_30d", marketCountry: initialMarket }),
      });
      const result = (await response.json()) as { invoiceUrl?: string; error?: string };
      if (!response.ok || !result.invoiceUrl) throw new Error(result.error ?? "invoice_failed");
      const app = window.Telegram?.WebApp;
      if (!app?.openInvoice) {
        window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
        return;
      }
      app.openInvoice(result.invoiceUrl, (status) => {
        if (status === "paid") {
          window.setTimeout(() => void syncTelegramProfile(saved, true), 1200);
        } else if (status === "failed") {
          setPaymentError(isIsrael ? "התשלום לא עבר. נסו שוב." : "Платёж не прошёл. Попробуйте ещё раз.");
        }
      });
    } catch {
      setPaymentError(isIsrael ? "לא הצלחנו לפתוח את התשלום. נסו שוב." : "Не удалось открыть оплату. Попробуйте ещё раз.");
    } finally {
      setBuying(false);
    }
  };

  const publishListing = async () => {
    if (!telegramInitData) {
      setListingMessage(isIsrael ? "פרסום זמין רק בתוך Telegram." : "Публикация доступна только внутри Telegram.");
      return;
    }
    setPublishingListing(true);
    setListingMessage(null);
    try {
      const response = await fetch("/api/telegram/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData: telegramInitData,
          marketCountry: initialMarket,
          make: listingMake,
          model: listingModel,
          year: Number(listingYear),
          price: Number(listingPrice),
          photoUrl: listingPhotoUrl || undefined,
          city,
        }),
      });
      const result = (await response.json()) as { published?: boolean; free?: boolean; invoiceUrl?: string; stars?: number };
      if (!response.ok) throw new Error("listing_failed");
      if (result.published) {
        setListingMessage(isIsrael ? "הרכב פורסם בחינם ✓" : "Автомобиль опубликован бесплатно ✓");
        setListingMake(""); setListingModel(""); setListingPrice(""); setListingPhotoUrl("");
        return;
      }
      if (!result.invoiceUrl) throw new Error("invoice_missing");
      const app = window.Telegram?.WebApp;
      if (!app?.openInvoice) {
        window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
        return;
      }
      app.openInvoice(result.invoiceUrl, (status) => {
        if (status === "paid") {
          setListingMessage(isIsrael ? "התשלום התקבל. הרכב מתפרסם ✓" : "Оплата получена. Автомобиль публикуется ✓");
          setListingMake(""); setListingModel(""); setListingPrice(""); setListingPhotoUrl("");
        } else if (status === "failed") {
          setListingMessage(isIsrael ? "התשלום לא עבר. הטיוטה לא פורסמה." : "Платёж не прошёл. Черновик не опубликован.");
        }
      });
    } catch {
      setListingMessage(isIsrael ? "לא הצלחנו ליצור מודעה. בדקו את הפרטים ונסו שוב." : "Не удалось создать объявление. Проверьте данные и попробуйте снова.");
    } finally {
      setPublishingListing(false);
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
        setCity(nearestCity(nextLocation.latitude, nextLocation.longitude, marketOptions.coordinates, marketOptions.cities[0]));
        setIndex(0);
        setLocationStatus("granted");
      });
    });
  };

  const lookupPrimaryVehicle = async () => {
    const plate = primaryPlate.replace(/[-\s]/g, "");
    if (!isIsrael || !/^\d{7,8}$/.test(plate)) return;
    setCheckingPrimaryPlate(true);
    setRegistrationError(null);
    setPrimaryLookupMessage(null);
    try {
      const response = await fetch(`/api/plate-lookup?country=IL&type=car&plate=${encodeURIComponent(plate)}`);
      const result = (await response.json()) as PlateLookupResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "lookup_failed");
      if (result.make) setPrimaryMake(result.make);
      if (result.model) setPrimaryModel(result.model);
      if (result.year) setPrimaryYear(String(result.year));
      setPrimaryLookupMessage(`✓ הפרטים התקבלו מ־${result.provider}`);
    } catch {
      setRegistrationError("לא הצלחנו למצוא את הרכב במאגר. אפשר למלא את הפרטים ידנית.");
    } finally {
      setCheckingPrimaryPlate(false);
    }
  };

  const uploadPrimaryPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!telegramInitData) {
      setPrimaryPhotoError(isIsrael ? "העלאת תמונות זמינה בתוך Telegram." : "Загрузка фото доступна внутри Telegram.");
      return;
    }
    const remaining = Math.max(0, 6 - primaryPhotoUrls.length);
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) return;
    setUploadingPrimaryPhotos(true);
    setPrimaryPhotoError(null);
    try {
      const formData = new FormData();
      formData.set("initData", telegramInitData);
      formData.set("marketCountry", initialMarket);
      selected.forEach((file) => formData.append("photos", file));
      const response = await fetch("/api/telegram/photos", { method: "POST", body: formData });
      const result = await response.json().catch(() => null) as { urls?: string[]; error?: string } | null;
      if (!response.ok || !result?.urls?.length) throw new Error(result?.error ?? "upload_failed");
      const nextUrls = [...primaryPhotoUrls, ...result.urls].slice(0, 6);
      setPrimaryPhotoUrls(nextUrls);
      setPrimaryPhotoUrl(nextUrls[0] ?? "");
      window.localStorage.setItem(storageKey, JSON.stringify({ city, budget, defaultSalePrice, radiusKm, primaryPlate, primaryMake, primaryModel, primaryYear, primaryMileage, primaryHand, primaryPhotoUrl: nextUrls[0] ?? "", primaryPhotoUrls: nextUrls, savedIds: saved.map((car) => car.car_id) }));
    } catch {
      setPrimaryPhotoError(isIsrael ? "לא הצלחנו להעלות את התמונות. נסו שוב." : "Не удалось загрузить фото. Попробуйте снова.");
    } finally {
      setUploadingPrimaryPhotos(false);
    }
  };

  const uploadListingPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!telegramInitData) {
      setListingMessage(isIsrael ? "העלאת תמונה זמינה בתוך Telegram." : "Загрузка фото доступна внутри Telegram.");
      return;
    }
    setUploadingListingPhoto(true);
    setListingMessage(null);
    try {
      const formData = new FormData();
      formData.set("initData", telegramInitData);
      formData.set("marketCountry", initialMarket);
      formData.append("photos", file);
      const response = await fetch("/api/telegram/photos", { method: "POST", body: formData });
      const result = await response.json().catch(() => null) as { urls?: string[]; error?: string } | null;
      if (!response.ok || !result?.urls?.[0]) throw new Error(result?.error ?? "upload_failed");
      setListingPhotoUrl(result.urls[0]);
    } catch {
      setListingMessage(isIsrael ? "לא הצלחנו להעלות את התמונה. נסו שוב." : "Не удалось загрузить фото. Попробуйте снова.");
    } finally {
      setUploadingListingPhoto(false);
    }
  };

  const removePrimaryPhoto = (url: string) => {
    const nextUrls = primaryPhotoUrls.filter((item) => item !== url);
    setPrimaryPhotoUrls(nextUrls);
    setPrimaryPhotoUrl(nextUrls[0] ?? "");
  };

  const openOfficialVehicleCheck = async () => {
    const vin = vehicleVin.trim().toUpperCase();
    const plate = vehiclePlate.trim().toUpperCase().replace(/[-\s]/g, "");
    if (isIsrael) {
      if (!/^\d{7,8}$/.test(plate)) {
        setVehicleCheckError("יש להזין מספר רישוי ישראלי בן 7 או 8 ספרות.");
        return;
      }
      setVehicleCheckError(null);
      setPlateLookupResult(null);
      setCheckingPlate(true);
      try {
        const response = await fetch(`/api/plate-lookup?country=IL&type=car&plate=${encodeURIComponent(plate)}`);
        const result = (await response.json()) as PlateLookupResult & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "lookup_failed");
        setPlateLookupResult(result);
      } catch {
        setVehicleCheckError("לא נמצא רכב או שמאגר משרד התחבורה אינו זמין כרגע.");
      } finally {
        setCheckingPlate(false);
      }
      return;
    }
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
    const requestedMarket = app.initDataUnsafe?.start_param?.toLowerCase();
    if (requestedMarket === "dealer_ru") {
      window.location.replace("/telegram/dealer");
    } else if ((requestedMarket === "il" || app.initDataUnsafe?.user?.language_code === "he") && initialMarket !== "IL") {
      window.location.replace("/telegram?market=IL");
    } else if (requestedMarket === "ru" && initialMarket !== "RU") {
      window.location.replace("/telegram?market=RU");
    }
  };

  const cardsBehind = useMemo(() => deckCars.slice(index + 1, index + 3), [deckCars, index]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js?63"
        strategy="afterInteractive"
        onLoad={setupTelegram}
      />
      <div className="telegram-app min-h-[100dvh] bg-[#070b18] text-white" lang={isIsrael ? "he" : "ru"} dir={isIsrael ? "rtl" : "ltr"}>
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black tracking-tight">SWITCH<span className="text-[#ff4f70]">APP</span></div>
              <div className="text-[11px] text-white/50">{isIsrael ? "הרכב הבא מוצא אתכם" : "Автомобили находят вас"}</div>
            </div>
            <button type="button" onClick={() => router.push(`/telegram?market=${isIsrael ? "RU" : "IL"}`)} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/75">
              {isIsrael ? "🇮🇱 עברית · RU" : "🇷🇺 Русский · HE"}
            </button>
          </header>
          {!isIsrael ? <button type="button" onClick={() => router.push("/telegram/dealer")} className="mb-4 rounded-2xl border border-[#ff4f70]/30 bg-[#ff4f70]/10 px-4 py-3 text-left text-xs font-bold text-[#ffb0bf]">Автосалон или импортёр? Открыть бизнес-кабинет →</button> : null}

          {stage === "welcome" && (
            <section className="flex flex-1 flex-col justify-center py-8">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#ff4f70]/30 bg-[#ff4f70]/10 px-3 py-1.5 text-xs font-semibold text-[#ff91a6]">
                {isIsrael ? "1,000 הראשונים · PLUS בחינם" : "FOUNDING 1000 · PLUS БЕСПЛАТНО"}
              </div>
              <h1 className="text-4xl font-black leading-[1.05] tracking-tight">
                {isIsrael ? "הרכב הבא שלכם נמצא במרחק החלקה." : "Ваш следующий автомобиль — одним свайпом."}
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-white/65">
                {isIsrael ? `היי ${displayName}, העלו את הרכב שלכם, הגדירו מה אתם מחפשים וקבלו התאמות למכירה או להחלפה.` : `Добро пожаловать, ${displayName}. Укажите, что вы ищете, и SwitchApp соберёт персональную ленту автомобилей.`}
              </p>
              <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs text-white/55">
                {(isIsrael ? [["01", "מגדירים"], ["02", "מחליקים"], ["03", "יוצרים קשר"]] : [["01", "Настройте"], ["02", "Свайпайте"], ["03", "Свяжитесь"]]).map(([n, label]) => (
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
                {isIsrael ? "מתחילים — ללא תשלום" : "Начать бесплатно"}
              </button>
              <p className="mt-3 text-center text-[11px] text-white/35">{isIsrael ? "ההרשמה והגלילה בחינם · ללא כרטיס אשראי" : "Регистрация и свайпы бесплатны · без карты"}</p>
            </section>
          )}

          {stage === "preferences" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-4 pb-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff91a6]">{isIsrael ? `שלב ${profileStep} מתוך 3` : `Шаг ${profileStep} из 3`}</div>
                <div className="flex gap-1.5" aria-label={isIsrael ? "התקדמות בהרשמה" : "Прогресс регистрации"}>
                  {[1, 2, 3].map((step) => <span key={step} className={`h-1.5 w-8 rounded-full ${step <= profileStep ? "bg-[#ff4f70]" : "bg-white/10"}`} />)}
                </div>
              </div>
              <h1 className="mt-3 text-3xl font-black">{profileStep === 1 ? (isIsrael ? "איפה ומה מחפשים?" : "Где и что ищем?") : profileStep === 2 ? (isIsrael ? "ספרו לנו על הרכב שלכם" : "Расскажите о вашем автомобиле") : (isIsrael ? "מחיר אחרון ויוצאים לדרך" : "Цена — и можно начинать")}</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">{profileStep === 1 ? (isIsrael ? "בחרו אזור ותקציב כדי שנציג רק רכבים רלוונטיים." : "Выберите регион и бюджет, чтобы видеть подходящие автомобили.") : profileStep === 2 ? (isIsrael ? "הרכב יפורסם גם למכירה וגם להחלפה. אפשר לשנות זאת בהמשך." : "Автомобиль будет доступен для продажи и обмена.") : (isIsrael ? "המחיר מאפשר לחשב מיד מי מוסיף וכמה בכל התאמה." : "Цена нужна для мгновенного расчёта доплаты.")}</p>

              <div className={profileStep === 1 ? "block" : "hidden"}>
              <label className="mt-8 block text-sm font-bold">{isIsrael ? "העיר שלכם" : "Ваш город"}</label>
              <button type="button" onClick={requestLocation} disabled={locationStatus === "requesting"} className="mt-3 rounded-2xl border border-[#ff4f70]/35 bg-[#ff4f70]/10 px-4 py-3 text-left text-sm font-bold text-[#ffb0bf] disabled:opacity-60">
                {locationStatus === "requesting" ? (isIsrael ? "מזהים מיקום…" : "Определяем местоположение…") : locationStatus === "granted" ? `✓ ${isIsrael ? "המיקום זוהה" : "Геолокация включена"} · ${city}` : isIsrael ? "⌖ זיהוי אוטומטי" : "⌖ Определить автоматически"}
              </button>
              {locationStatus === "denied" ? <p className="mt-2 text-xs text-white/45">{isIsrael ? "אין גישה למיקום. בחרו עיר ידנית." : "Нет доступа к геолокации. Выберите город вручную."}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {marketOptions.cities.map((item) => (
                  <button key={item} type="button" onClick={() => setCity(item)} className={`rounded-full px-4 py-2 text-sm ${city === item ? "bg-white text-[#070b18]" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item}
                  </button>
                ))}
              </div>

              <label className="mt-6 text-sm font-bold">{isIsrael ? "רדיוס חיפוש" : "Радиус поиска"}</label>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {SEARCH_RADII.map((item) => (
                  <button key={item} type="button" onClick={() => { setRadiusKm(item); setIndex(0); }} className={`rounded-xl px-2 py-2.5 text-xs font-semibold ${radiusKm === item ? "bg-white text-[#070b18]" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item} {isIsrael ? "ק״מ" : "км"}
                  </button>
                ))}
              </div>

              <label className="mt-7 text-sm font-bold">{isIsrael ? "תקציב" : "Бюджет"}</label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {marketOptions.budgets.map((item) => (
                  <button key={item} type="button" onClick={() => setBudget(item)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${budget === item ? "bg-[#ff4f70] text-white" : "border border-white/10 bg-white/5 text-white/70"}`}>
                    {item}
                  </button>
                ))}
              </div>
              </div>

              <div className={`${profileStep === 2 ? "block" : "hidden"} mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-4`}>
                <div className="text-sm font-black">{isIsrael ? "הרכב שלכם" : "Ваш автомобиль"}</div>
                <p className="mt-1 text-xs leading-5 text-white/45">{isIsrael ? "הרכב יפורסם כברירת מחדל גם למכירה וגם להחלפה." : "Автомобиль по умолчанию публикуется и для продажи, и для обмена."}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs text-white/60">{isIsrael ? "מספר רישוי" : "Госномер"}<input value={primaryPlate} onChange={(event) => { setPrimaryPlate(event.target.value); setPrimaryLookupMessage(null); }} onBlur={() => { if (isIsrael && /^\d{7,8}$/.test(primaryPlate.replace(/[-\s]/g, ""))) void lookupPrimaryVehicle(); }} placeholder={isIsrael ? "12-345-67" : "А123ВС77"} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                  <label className="text-xs text-white/60">{isIsrael ? "יצרן" : "Марка"}<input value={primaryMake} onChange={(event) => setPrimaryMake(event.target.value)} placeholder="Toyota" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                  <label className="text-xs text-white/60">{isIsrael ? "דגם" : "Модель"}<input value={primaryModel} onChange={(event) => setPrimaryModel(event.target.value)} placeholder="Corolla" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                  <label className="text-xs text-white/60">{isIsrael ? "שנה" : "Год"}<input type="number" inputMode="numeric" value={primaryYear} onChange={(event) => setPrimaryYear(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                  <label className="text-xs text-white/60">{isIsrael ? "קילומטראז׳" : "Пробег, км"}<input type="number" inputMode="numeric" value={primaryMileage} onChange={(event) => setPrimaryMileage(event.target.value)} placeholder="75000" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                  <label className="text-xs text-white/60">{isIsrael ? "יד" : "Владельцев"}<input type="number" inputMode="numeric" min="0" max="20" value={primaryHand} onChange={(event) => setPrimaryHand(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" /></label>
                </div>
                {isIsrael ? <button type="button" onClick={() => void lookupPrimaryVehicle()} disabled={checkingPrimaryPlate || !/^\d{7,8}$/.test(primaryPlate.replace(/[-\s]/g, ""))} className="mt-3 w-full rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2.5 text-xs font-bold text-emerald-100 disabled:opacity-40">{checkingPrimaryPlate ? "מאתרים את הרכב…" : "מילוי פרטי הרכב לפי מספר הרישוי"}</button> : null}
                {primaryLookupMessage ? <p className="mt-2 text-xs font-semibold text-emerald-300">{primaryLookupMessage}</p> : null}
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white/75">{isIsrael ? "תמונות הרכב" : "Фотографии автомобиля"}</span>
                    <span className="text-[11px] text-white/40">{primaryPhotoUrls.length}/6</span>
                  </div>
                  {primaryPhotoUrls.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {primaryPhotoUrls.map((url, photoIndex) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={isIsrael ? `תמונת רכב ${photoIndex + 1}` : `Фото автомобиля ${photoIndex + 1}`} className="h-full w-full object-cover" />
                          {photoIndex === 0 ? <span className="absolute bottom-1 start-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold">{isIsrael ? "ראשית" : "Главная"}</span> : null}
                          <button type="button" onClick={() => removePrimaryPhoto(url)} aria-label={isIsrael ? "הסרת תמונה" : "Удалить фото"} className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-sm text-white">×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {primaryPhotoUrls.length < 6 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="cursor-pointer rounded-xl border border-[#ff4f70]/30 bg-[#ff4f70]/10 px-3 py-3 text-center text-xs font-bold text-pink-100">
                        {uploadingPrimaryPhotos ? (isIsrael ? "מעלה…" : "Загрузка…") : (isIsrael ? "📷 צילום עכשיו" : "📷 Сделать фото")}
                        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingPrimaryPhotos} onChange={(event) => { void uploadPrimaryPhotos(event.target.files); event.target.value = ""; }} />
                      </label>
                      <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-center text-xs font-bold text-white/80">
                        {uploadingPrimaryPhotos ? (isIsrael ? "מעלה…" : "Загрузка…") : (isIsrael ? "🖼️ בחירה מהטלפון" : "🖼️ Выбрать из галереи")}
                        <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingPrimaryPhotos} onChange={(event) => { void uploadPrimaryPhotos(event.target.files); event.target.value = ""; }} />
                      </label>
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-4 text-white/40">{isIsrael ? "עד 6 תמונות. התמונה הראשונה תהיה התמונה הראשית." : "До 6 фото. Первое фото будет главным."}</p>
                  {primaryPhotoError ? <p className="mt-2 text-xs text-red-300">{primaryPhotoError}</p> : null}
                </div>
              </div>

              <div className={profileStep === 3 ? "block" : "hidden"}>
              <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 text-4xl">₪</div>
              <label className="text-sm font-bold" htmlFor="default-sale-price">{isIsrael ? "מה מחיר המכירה של הרכב שלכם?" : "Цена продажи вашего автомобиля"}</label>
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
                  placeholder={isIsrael ? "לדוגמה, 85,000" : "Например, 1 800 000"}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white outline-none focus:border-[#ff4f70]/60"
                />
                <span className="absolute right-4 top-3 text-white/45">{isIsrael ? "₪" : "₽"}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/45">{isIsrael ? "נציג בכל התאמה את מחיר הרכב שלכם, מחיר הרכב שמצאתם ואת ההפרש לתשלום." : "Эта цена будет использоваться для расчёта доплаты."}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-xs leading-5 text-emerald-100/80">
                {isIsrael ? "✓ ההרשמה והגלילה ללא תשלום  ·  ✓ הרכב הראשון מתפרסם בחינם  ·  ✓ ללא כרטיס אשראי" : "✓ Регистрация и свайпы бесплатны  ·  ✓ Первое объявление бесплатно"}
              </div>
              </div>

              <div className="mt-auto flex gap-3 pt-7">
                {profileStep > 1 ? <button type="button" onClick={() => setProfileStep((profileStep - 1) as 1 | 2)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white/75">{isIsrael ? "חזרה" : "Назад"}</button> : null}
                {profileStep < 3 ? (
                  <button type="button" onClick={() => { setRegistrationError(null); setProfileStep((profileStep + 1) as 2 | 3); }} disabled={profileStep === 2 && (!primaryPlate.trim() || !primaryMake.trim() || !primaryModel.trim() || Number(primaryYear) < 1950 || !primaryMileage)} className="flex-1 rounded-2xl bg-white px-5 py-4 text-base font-black text-[#070b18] disabled:opacity-40">{isIsrael ? "המשך" : "Продолжить"}</button>
                ) : (
                  <button type="button" onClick={() => void syncTelegramProfile(saved, true)} disabled={registering || !Number.isFinite(ownCarPrice) || ownCarPrice < 10000} className="flex-1 rounded-2xl bg-[#ff4f70] px-5 py-4 text-base font-black text-white shadow-[0_18px_50px_rgba(255,79,112,0.28)] disabled:opacity-60">
                    {registering ? (isIsrael ? "שומרים…" : "Сохраняем…") : isIsrael ? "מצאו לי רכבים" : "Показать автомобили"}
                  </button>
                )}
              </div>
              {registrationError ? <p className="mt-3 text-center text-xs text-red-300">{registrationError}</p> : null}
            </section>
          )}

          {stage === "deck" && (
            <section className="flex min-h-0 flex-1 flex-col pb-2">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                  <span className="truncate">{city} · {budget}</span>
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
                    <div className="relative h-full min-h-80 bg-gradient-to-br from-slate-700 to-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element -- listing hosts are user-controlled; the existing marketplace uses the same safe URL list. */}
                      <img src={current.photo_urls?.[0] || "/campaign/dealer-choice.webp"} alt={`${current.make} ${current.model}`} className="h-full w-full object-cover" draggable={false} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-[#0b1020]/25 to-black/15" />
                      <div className={`absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-xl font-black text-emerald-300 transition-opacity ${dragX > 30 ? "opacity-100" : "opacity-0"}`}>{isIsrael ? "מתאים לי" : "БЕРУ"}</div>
                      <div className={`absolute right-5 top-6 rotate-12 rounded-lg border-4 border-white/80 px-3 py-1 text-xl font-black text-white transition-opacity ${dragX < -30 ? "opacity-100" : "opacity-0"}`}>{isIsrael ? "לא מתאים" : "ДАЛЬШЕ"}</div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 text-shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><h2 className="text-2xl font-black leading-tight">{current.make} {current.model}</h2><p className="mt-1.5 text-sm text-white/70">{current.year || (isIsrael ? "שנה לא צוינה" : "Год не указан")} · {current.seller_name}</p></div>
                        <div className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/15 px-3 py-1.5 text-[11px] font-bold text-emerald-200">✓ {isIsrael ? "מודעה מאומתת" : "ПРОВЕРЕНО"}</div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-white/10 bg-black/35 p-3"><div className="text-white/55">{isIsrael ? "מחיר מבוקש" : "Цена"}</div><div className="mt-1 text-base font-black text-white">{displayPrice(current, isIsrael)}</div></div>
                        <div className="rounded-xl border border-white/10 bg-black/35 p-3"><div className="text-white/55">{isIsrael ? "הרכב שלכם" : "Ваш автомобиль"}</div><div className="mt-1 text-base font-black text-white">{formatPrice(ownCarPrice, isIsrael)} {isIsrael ? "₪" : "₽"}</div></div>
                      </div>
                      {hasBuyerAccess && priceDifference != null ? (
                        <div className="mt-2 rounded-xl border border-amber-300/20 bg-black/45 px-3 py-2.5 text-sm" aria-live="polite">
                          {priceDifference === 0 ? (
                            <span className="font-bold text-emerald-300">{isIsrael ? "החלפה ללא תוספת" : "Обмен без доплаты"}</span>
                          ) : priceDifference > 0 ? (
                            <><span className="text-white/55">{isIsrael ? "עליכם להוסיף " : "Вы доплачиваете "}</span><span className="font-black text-amber-300">{formatPrice(priceDifference, isIsrael)} {isIsrael ? "₪" : "₽"}</span></>
                          ) : (
                            <><span className="text-white/55">{isIsrael ? "מוסיפים לכם " : "Вам доплачивают "}</span><span className="font-black text-emerald-300">{formatPrice(Math.abs(priceDifference), isIsrael)} {isIsrael ? "₪" : "₽"}</span></>
                          )}
                        </div>
                      ) : hasBuyerAccess ? <div className="mt-3 text-xs text-white/50">{isIsrael ? "אין מחיר זמין לחישוב ההפרש." : "Нет цены — расчёт доплаты недоступен."}</div> : (
                        <button type="button" onClick={() => setStage("access")} className="mt-3 w-full rounded-xl border border-[#ff4f70]/25 bg-[#ff4f70]/10 px-3 py-2 text-left text-xs font-bold text-[#ffb0bf]">
                          {isIsrael ? "★ התאמה חכמה וחישוב ההפרש — ב־Plus" : "★ Совместимость и расчёт доплаты — в Plus"}
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="text-5xl">✓</div><h2 className="mt-4 text-2xl font-black">{isIsrael ? "עברתם על כל הרכבים" : "Вы просмотрели всё"}</h2><p className="mt-2 text-sm text-white/55">{isIsrael ? "נעדכן אתכם כשיתווספו התאמות חדשות." : "Мы сообщим, когда появятся новые варианты."}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => choose(false)} disabled={!current} aria-label={isIsrael ? "לא מתאים" : "Пропустить"} className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-xs font-bold text-white/70 disabled:opacity-30">× {isIsrael ? "לא מתאים" : "Пропустить"}</button>
                <button type="button" onClick={() => setStage("vehicle-check")} className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-xs font-bold text-white/70">☰ {isIsrael ? "פרטי הרכב" : "Подробнее"}</button>
                <button type="button" onClick={() => choose(true)} disabled={!current} aria-label={isIsrael ? "מתאים לי" : "Сохранить"} className="rounded-2xl bg-[#ff4f70] px-2 py-3 text-xs font-black text-white shadow-[0_12px_35px_rgba(255,79,112,0.28)] disabled:opacity-30">♥ {isIsrael ? "מתאים לי" : "Сохранить"}</button>
              </div>
            </section>
          )}

          {stage === "access" && (
            <section className="flex flex-1 flex-col justify-center py-8">
              <button type="button" onClick={() => setStage("deck")} className="mb-5 w-fit text-sm text-white/55">{isIsrael ? "→ חזרה לרכבים" : "← Назад к автомобилям"}</button>
              <div className="inline-flex w-fit rounded-full border border-[#ff4f70]/30 bg-[#ff4f70]/10 px-3 py-1.5 text-xs font-bold text-[#ff91a6]">
                {isIsrael ? "הרשמה והחלקות — בחינם" : "СВАЙПЫ И РЕГИСТРАЦИЯ — БЕСПЛАТНО"}
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight">{isIsrael ? "משלמים רק על התאמה חכמה" : "Платите только за точное совпадение"}</h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {isIsrael ? "מחפשים, מחליקים ושומרים רכבים בחינם. Plus משתמש בנתוני הרכב ובהעדפות שלכם כדי להציג עסקאות מתאימות יותר." : "Ищите, свайпайте и сохраняйте автомобили бесплатно. Plus использует данные автомобиля и ваших предпочтений, чтобы показать лучшие варианты сделки."}
              </p>
              <div className="mt-7 rounded-3xl border border-[#ff4f70]/30 bg-[#ff4f70]/10 p-5">
                <div className="flex items-end justify-between gap-3">
                  <div><div className="text-lg font-black">SwitchApp Plus</div><div className="mt-1 text-xs text-white/50">{isIsrael ? "30 ימי גישה" : "30 дней доступа"}</div></div>
                  <div className="text-3xl font-black">300 <span className="text-base text-[#ff91a6]">★</span></div>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  <li>✓ {isIsrael ? "ציון התאמה בין הרכבים" : "Оценка совместимости с автомобилем"}</li>
                  <li>✓ {isIsrael ? "חישוב הפרש — מי מוסיף וכמה" : "Расчёт доплаты — кто и кому платит"}</li>
                  <li>✓ {isIsrael ? "התראות מוקדמות על התאמות חדשות" : "Ранние уведомления о лучших вариантах"}</li>
                  <li>✓ {isIsrael ? "מסננים מתקדמים והיסטוריית החלקות" : "Расширенные фильтры и история свайпов"}</li>
                </ul>
              </div>
              {hasBuyerAccess ? (
                <button type="button" onClick={() => setStage("deck")} className="mt-6 rounded-2xl bg-emerald-400 px-5 py-4 text-base font-black text-[#07120d]">{isIsrael ? "Plus פעיל · המשך לרכבים" : "Plus активен · продолжить"}</button>
              ) : (
                <button type="button" onClick={() => void buyBuyerAccess()} disabled={buying} className="mt-6 rounded-2xl bg-[#ff4f70] px-5 py-4 text-base font-black disabled:opacity-60">
                  {buying ? (isIsrael ? "פותחים את התשלום…" : "Открываем оплату…") : (isIsrael ? "פתיחת Plus ב־300 כוכבים" : "Открыть Plus за 300 Stars")}
                </button>
              )}
              <p className="mt-3 text-center text-[11px] text-white/35">{isIsrael ? "30 ימים · תשלום חד־פעמי · ללא חידוש אוטומטי" : "30 дней · разовый платёж · без автопродления"}</p>
              {paymentError ? <p className="mt-3 rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-center text-xs text-red-200">{paymentError}</p> : null}
            </section>
          )}

          {stage === "saved" && (
            <section className="flex flex-1 flex-col">
              <button type="button" onClick={() => setStage(index ? "deck" : "welcome")} className="mb-5 w-fit text-sm text-white/55">{isIsrael ? "→ חזרה" : "← Назад"}</button>
              <h1 className="text-3xl font-black">{isIsrael ? "שמורים" : "Избранное"}</h1>
              <p className="mt-2 text-sm text-white/50">{isIsrael ? "רכבים שסימנתם בהחלקה ימינה." : "Автомобили, которые вы отметили свайпом вправо."}</p>
              <div className="mt-6 space-y-3">
                {saved.length ? saved.map((car) => (
                  <div key={car.car_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- see listing image note above. */}
                    <img src={car.photo_urls?.[0] || "/campaign/dealer-choice.webp"} alt="" className="h-16 w-20 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1"><div className="truncate font-bold">{car.make} {car.model}</div><div className="mt-1 text-xs text-white/45">{displayPrice(car, isIsrael)}</div></div>
                    <span className="text-[#ff91a6]">♥</span>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">{isIsrael ? "עדיין ריק — החליקו ימינה על רכב שאהבתם." : "Пока пусто — свайпните понравившийся автомобиль вправо."}</div>}
              </div>
            </section>
          )}

          {stage === "sell" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
              <button type="button" onClick={() => setStage(index ? "deck" : "welcome")} className="mb-5 w-fit text-sm text-white/55">{isIsrael ? "→ חזרה" : "← Назад"}</button>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff91a6]">{isIsrael ? "מכירת רכב" : "Продать автомобиль"}</div>
              <h1 className="mt-2 text-3xl font-black">{isIsrael ? "פרסום הרכב הראשון בחינם" : "Первое объявление бесплатно"}</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">{isIsrael ? "כל רכב נוסף — 150 כוכבי Telegram. תשלום חד־פעמי, ללא מנוי." : "Каждый следующий автомобиль — 150 Telegram Stars. Оплата разовая, без подписки."}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-white/65">{isIsrael ? "יצרן" : "Марка"}<input value={listingMake} onChange={(event) => setListingMake(event.target.value)} placeholder="Toyota" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-[#ff4f70]/60" /></label>
                <label className="text-xs font-bold text-white/65">{isIsrael ? "דגם" : "Модель"}<input value={listingModel} onChange={(event) => setListingModel(event.target.value)} placeholder="RAV4" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-[#ff4f70]/60" /></label>
                <label className="text-xs font-bold text-white/65">{isIsrael ? "שנה" : "Год"}<input type="number" inputMode="numeric" value={listingYear} onChange={(event) => setListingYear(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-[#ff4f70]/60" /></label>
                <label className="text-xs font-bold text-white/65">{isIsrael ? "מחיר, ₪" : "Цена, ₽"}<input type="number" inputMode="numeric" min="10000" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} placeholder={isIsrael ? "85000" : "1800000"} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-[#ff4f70]/60" /></label>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs font-bold text-white/75">{isIsrael ? "תמונת הרכב" : "Фотография автомобиля"}</div>
                {listingPhotoUrl ? <div className="mt-3 flex items-center gap-3"><img src={listingPhotoUrl} alt={isIsrael ? "תמונת הרכב לפרסום" : "Фото автомобиля"} className="h-20 w-24 rounded-xl object-cover" /><button type="button" onClick={() => setListingPhotoUrl("")} className="text-xs font-bold text-red-200">{isIsrael ? "הסרת תמונה" : "Удалить фото"}</button></div> : null}
                {!listingPhotoUrl ? <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="cursor-pointer rounded-xl bg-[#ff4f70]/15 px-3 py-3 text-center text-xs font-bold text-pink-100">{uploadingListingPhoto ? (isIsrael ? "מעלה…" : "Загрузка…") : (isIsrael ? "📷 צילום עכשיו" : "📷 Сделать фото")}<input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingListingPhoto} onChange={(event) => { void uploadListingPhoto(event.target.files); event.target.value = ""; }} /></label>
                  <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs font-bold text-white/80">{uploadingListingPhoto ? (isIsrael ? "מעלה…" : "Загрузка…") : (isIsrael ? "🖼️ מהגלריה" : "🖼️ Из галереи")}<input type="file" accept="image/*" className="hidden" disabled={uploadingListingPhoto} onChange={(event) => { void uploadListingPhoto(event.target.files); event.target.value = ""; }} /></label>
                </div> : null}
              </div>
              <button type="button" onClick={() => void publishListing()} disabled={publishingListing || !listingMake.trim() || !listingModel.trim() || Number(listingPrice) < 10000} className="mt-6 rounded-2xl bg-white px-5 py-4 text-base font-black text-[#070b18] disabled:opacity-50">
                {publishingListing ? (isIsrael ? "יוצרים מודעה…" : "Создаём объявление…") : isIsrael ? "פרסום הרכב" : "Опубликовать автомобиль"}
              </button>
              {listingMessage ? <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-white/70">{listingMessage}</p> : null}
            </section>
          )}

          {stage === "vehicle-check" && (
            <section className="flex flex-1 flex-col">
              <button type="button" onClick={() => setStage("deck")} className="mb-5 w-fit text-sm text-white/55">{isIsrael ? "→ חזרה לרכבים" : "← Назад"}</button>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff91a6]">{isIsrael ? "בדיקה לפני קנייה" : "Проверка перед покупкой"}</div>
              <h1 className="mt-2 text-3xl font-black">{isIsrael ? "בדיקת רכב" : "Проверьте автомобиль"}</h1>
              <p className="mt-3 text-sm leading-6 text-white/55">{isIsrael ? "הזינו מספר רישוי. הבדיקה הרשמית תיפתח באתר המידע הממשלתי." : "Введите госномер и VIN. Официальная проверка откроется на сайте Госавтоинспекции России."}</p>
              <label className="mt-7 text-sm font-bold" htmlFor="ru-plate">{isIsrael ? "מספר רישוי" : "Госномер"}</label>
              <input id="ru-plate" value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} placeholder={isIsrael ? "12-345-67" : "А123ВС77"} autoCapitalize="characters" className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ff4f70]/60" />
              {!isIsrael ? <><label className="mt-5 text-sm font-bold" htmlFor="ru-vin">VIN</label>
              <input id="ru-vin" value={vehicleVin} onChange={(event) => setVehicleVin(event.target.value)} placeholder="17 символов" autoCapitalize="characters" className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white outline-none focus:border-[#ff4f70]/60" /></> : null}
              <button type="button" onClick={() => void openOfficialVehicleCheck()} disabled={checkingPlate} className="mt-6 rounded-2xl bg-white px-5 py-4 text-base font-black text-[#070b18] disabled:opacity-60">{checkingPlate ? (isIsrael ? "בודקים במאגר הרשמי…" : "Проверяем…") : isIsrael ? "בדיקה לפי מספר רישוי" : "Открыть официальную проверку"}</button>
              {vehicleCheckError ? <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{vehicleCheckError}</p> : null}
              {plateLookupResult ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
                  <div className="font-black">{plateLookupResult.make} {plateLookupResult.model}</div>
                  <div>{[plateLookupResult.year, plateLookupResult.color, plateLookupResult.fuel_type].filter(Boolean).join(" · ")}</div>
                  <div className="mt-2 text-xs text-emerald-100/60">מקור: {plateLookupResult.provider}</div>
                </div>
              ) : null}
              <p className="mt-5 text-xs leading-5 text-white/35">{isIsrael ? "הבדיקה מבוססת על מקור המידע הזמין בישראל. מומלץ להשלים בדיקה מקצועית לפני רכישה." : "Мы не сохраняем VIN или номер автомобиля на этом этапе. Для автоматического отчёта по госномеру потребуется договор с лицензированным поставщиком данных."}</p>
            </section>
          )}

          {stage !== "welcome" && stage !== "preferences" ? (
            <nav className="mt-4 grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-[#0d1324]/95 p-1.5" aria-label={isIsrael ? "ניווט ראשי" : "Главная навигация"}>
              {([
                ["deck", "⌁", isIsrael ? "התאמות" : "Подбор"],
                ["saved", "♥", isIsrael ? `שמורים ${saved.length}` : `Избранное ${saved.length}`],
                ["sell", "+", isIsrael ? "מכירה" : "Продать"],
                ["vehicle-check", "✓", isIsrael ? "בדיקה" : "Проверка"],
                ["access", "★", "Plus"],
              ] as const).map(([target, icon, label]) => (
                <button key={target} type="button" onClick={() => setStage(target)} className={`rounded-xl px-1 py-2 text-[10px] font-bold ${stage === target ? "bg-white text-[#070b18]" : "text-white/55"}`}>
                  <span className="mb-1 block text-base leading-none">{icon}</span>{label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}

