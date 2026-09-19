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
}

const ALLOWED_CITIES = new Set(["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"]);
const ALLOWED_BUDGETS = new Set(["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"]);
const PILOT_MARKET = "RU";
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

  const verified = validateTelegramInitData(body.initData ?? "", botToken);
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  if (body.marketCountry !== PILOT_MARKET) {
    return NextResponse.json({ error: "Invalid market" }, { status: 400 });
  }
  if (!body.city || !ALLOWED_CITIES.has(body.city) || !body.budget || !ALLOWED_BUDGETS.has(body.budget)) {
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
  const supabase = createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: lookupError } = await supabase
    .from("telegram_pilot_users")
    .select("founder_number,premium_until")
    .eq("telegram_user_id", verified.user.id)
    .eq("market_country", PILOT_MARKET)
    .maybeSingle<{ founder_number: number | null; premium_until: string | null }>();
  if (lookupError) return NextResponse.json({ error: "Registration lookup failed" }, { status: 500 });

  const record = {
    telegram_user_id: verified.user.id,
    market_country: PILOT_MARKET,
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
    ? supabase.from("telegram_pilot_users").update(record).eq("telegram_user_id", verified.user.id).eq("market_country", PILOT_MARKET).select("founder_number,premium_until").single()
    : supabase.from("telegram_pilot_users").insert(record).select("founder_number,premium_until").single();
  const { data, error } = await mutation;
  if (error) return NextResponse.json({ error: "Registration failed" }, { status: 500 });

  const user = data as { founder_number: number | null; premium_until: string | null };
  return NextResponse.json({
    founderNumber: user.founder_number,
    founder: Boolean(user.founder_number),
    premiumUntil: user.premium_until,
    hasBuyerAccess: Boolean(user.founder_number) || Boolean(user.premium_until && new Date(user.premium_until) > new Date()),
  });
}
