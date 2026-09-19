import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { validateTelegramInitData } from "@/lib/telegram/validateInitData";

interface RegisterBody {
  initData?: string;
  marketCountry?: string;
  city?: string;
  budget?: string;
  defaultSalePrice?: number;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  radiusKm?: number;
  savedCarIds?: string[];
  vehicle?: {
    plate?: string;
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    hand?: number;
    photoUrl?: string;
  };
}

const MARKET_OPTIONS = {
  RU: {
    cities: new Set(["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"]),
    budgets: new Set(["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"]),
  },
  IL: {
    cities: new Set(["תל אביב", "ירושלים", "חיפה", "באר שבע", "ראשון לציון"]),
    budgets: new Set(["עד 60,000 ₪", "60–100 אלף ₪", "100–160 אלף ₪", "מעל 160 אלף ₪"]),
  },
} as const;
const ALLOWED_RADII = new Set([25, 50, 100, 250]);

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!botToken || !secretKey) {
    return NextResponse.json({ error: "Telegram pilot is not configured" }, { status: 503 });
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = validateTelegramInitData(body.initData ?? "", botToken, 60 * 60, process.env.TELEGRAM_BOT_ID ?? "8875971815");
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  const market = body.marketCountry === "IL" ? "IL" : body.marketCountry === "RU" ? "RU" : null;
  if (!market) {
    return NextResponse.json({ error: "Invalid market" }, { status: 400 });
  }
  const marketOptions = MARKET_OPTIONS[market];
  if (!body.city || !marketOptions.cities.has(body.city as never) || !body.budget || !marketOptions.budgets.has(body.budget as never)) {
    return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  }
  if (!body.radiusKm || !ALLOWED_RADII.has(body.radiusKm)) {
    return NextResponse.json({ error: "Invalid search radius" }, { status: 400 });
  }
  if (typeof body.defaultSalePrice !== "number" || !Number.isFinite(body.defaultSalePrice) || body.defaultSalePrice < 10000 || body.defaultSalePrice > 1000000000) {
    return NextResponse.json({ error: "Invalid sale price" }, { status: 400 });
  }
  const hasLocation = body.latitude != null || body.longitude != null;
  if (hasLocation && (
    typeof body.latitude !== "number" || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90 ||
    typeof body.longitude !== "number" || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180
  )) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const savedCarIds = Array.from(new Set((body.savedCarIds ?? []).filter((value) => /^[-a-zA-Z0-9]{1,80}$/.test(value)))).slice(0, 100);
  const vehicle = body.vehicle;
  const cleanVehicleText = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
  const vehicleMake = cleanVehicleText(vehicle?.make, 60);
  const vehicleModel = cleanVehicleText(vehicle?.model, 80);
  const vehiclePlate = cleanVehicleText(vehicle?.plate, 20).replace(/[\s-]/g, "").toUpperCase();
  const vehicleYear = Number(vehicle?.year);
  const vehicleMileage = Number(vehicle?.mileage);
  const vehicleHand = Number(vehicle?.hand);
  if (!vehicleMake || !vehicleModel || !vehiclePlate || !Number.isInteger(vehicleYear) || vehicleYear < 1950 || vehicleYear > new Date().getFullYear() + 1 || !Number.isFinite(vehicleMileage) || vehicleMileage < 0 || vehicleMileage > 5000000 || !Number.isInteger(vehicleHand) || vehicleHand < 0 || vehicleHand > 20) {
    return NextResponse.json({ error: "Invalid vehicle profile" }, { status: 400 });
  }
  const validPlate = market === "IL"
    ? /^\d{7,8}$/.test(vehiclePlate)
    : /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/.test(vehiclePlate);
  if (!validPlate) return NextResponse.json({ error: "Invalid vehicle plate" }, { status: 400 });
  let vehiclePhotoUrl: string | null = null;
  if (vehicle?.photoUrl) {
    try {
      const parsed = new URL(vehicle.photoUrl);
      if (parsed.protocol !== "https:") throw new Error("invalid_protocol");
      vehiclePhotoUrl = parsed.toString().slice(0, 1000);
    } catch {
      return NextResponse.json({ error: "Invalid vehicle photo" }, { status: 400 });
    }
  }
  const supabase = createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: lookupError } = await supabase
    .from("telegram_pilot_users")
    .select("founder_number,premium_until")
    .eq("telegram_user_id", verified.user.id)
    .eq("market_country", market)
    .maybeSingle<{ founder_number: number | null; premium_until: string | null }>();
  if (lookupError) return NextResponse.json({ error: "Registration lookup failed" }, { status: 500 });

  const record = {
    telegram_user_id: verified.user.id,
    market_country: market,
    username: verified.user.username ?? null,
    first_name: verified.user.first_name,
    last_name: verified.user.last_name ?? null,
    language_code: verified.user.language_code ?? null,
    city: body.city,
    budget: body.budget,
    default_sale_price: Math.round(body.defaultSalePrice),
    latitude: hasLocation ? Number(body.latitude!.toFixed(3)) : null,
    longitude: hasLocation ? Number(body.longitude!.toFixed(3)) : null,
    location_accuracy_m: typeof body.locationAccuracyM === "number" && Number.isFinite(body.locationAccuracyM)
      ? Math.max(0, Math.min(Math.round(body.locationAccuracyM), 100000))
      : null,
    search_radius_km: body.radiusKm,
    saved_car_ids: savedCarIds,
    start_param: verified.startParam,
    last_seen_at: new Date().toISOString(),
  };

  const mutation = existing
    ? supabase.from("telegram_pilot_users").update(record).eq("telegram_user_id", verified.user.id).eq("market_country", market).select("founder_number,premium_until").single()
    : supabase.from("telegram_pilot_users").insert(record).select("founder_number,premium_until").single();
  const { data, error } = await mutation;
  if (error) return NextResponse.json({ error: "Registration failed" }, { status: 500 });

  const user = data as { founder_number: number | null; premium_until: string | null };
  const { error: vehicleError } = await supabase.from("market_vehicle_inventory").upsert({
    market_country: market,
    source_name: "telegram_primary",
    source_listing_id: `telegram-primary-${verified.user.id}`,
    seller_telegram_user_id: verified.user.id,
    seller_name: verified.user.first_name,
    make: vehicleMake,
    model: vehicleModel,
    year: vehicleYear,
    price: Math.round(body.defaultSalePrice),
    currency: market === "IL" ? "ILS" : "RUB",
    latitude: hasLocation ? Number(body.latitude!.toFixed(3)) : null,
    longitude: hasLocation ? Number(body.longitude!.toFixed(3)) : null,
    photo_urls: vehiclePhotoUrl ? [vehiclePhotoUrl] : [],
    status: "active",
    source_payload: { city: body.city, plate: vehiclePlate, mileage: Math.round(vehicleMileage), hand: vehicleHand, for_sale: true, for_swap: true },
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "market_country,source_name,source_listing_id" });
  if (vehicleError) return NextResponse.json({ error: "Vehicle profile failed" }, { status: 500 });
  return NextResponse.json({
    founderNumber: user.founder_number,
    founder: Boolean(user.founder_number),
    premiumUntil: user.premium_until,
    hasBuyerAccess: Boolean(user.founder_number) || Boolean(user.premium_until && new Date(user.premium_until) > new Date()),
  });
}
