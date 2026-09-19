import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { validateTelegramInitData } from "@/lib/telegram/validateInitData";

type Availability = "in_stock" | "in_transit" | "on_order" | "reserved" | "sold";

interface DealerBody {
  initData?: string;
  action?: "register" | "upsert_listing" | "set_status" | "import_csv";
  account?: Record<string, unknown>;
  listing?: Record<string, unknown>;
  listings?: Record<string, unknown>[];
  listingId?: string;
  availability?: Availability;
}

const AVAILABILITY = new Set<Availability>(["in_stock", "in_transit", "on_order", "reserved", "sold"]);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const number = (value: unknown, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? Math.round(parsed) : null;
};

function serverClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  return key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function verify(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? validateTelegramInitData(initData, token, 60 * 60, process.env.TELEGRAM_BOT_ID ?? "8875971815") : null;
}

function normalizeListing(raw: Record<string, unknown>, userId: number, businessName: string) {
  const make = text(raw.make, 60);
  const model = text(raw.model, 80);
  const city = text(raw.city, 80);
  const year = number(raw.year, 1950, new Date().getFullYear() + 2);
  const price = number(raw.price, 10000, 1_000_000_000);
  const mileage = number(raw.mileage, 0, 5_000_000);
  const requested = text(raw.availability, 24) as Availability;
  const availability: Availability = AVAILABILITY.has(requested) ? requested : "in_stock";
  if (!make || !model || !city || !year || !price) return null;
  const photos = Array.isArray(raw.photo_urls)
    ? raw.photo_urls.filter((url): url is string => typeof url === "string" && url.startsWith("https://")).slice(0, 12)
    : [];
  return {
    market_country: "RU",
    source_name: "telegram_dealer",
    source_listing_id: text(raw.source_listing_id, 120) || randomUUID(),
    seller_telegram_user_id: userId,
    seller_name: businessName,
    make,
    model,
    year,
    price,
    currency: "RUB",
    photo_urls: photos,
    status: availability === "sold" ? "sold" : availability === "reserved" ? "paused" : "active",
    source_payload: {
      dealer_account: true,
      availability,
      city,
      mileage,
      vin: text(raw.vin, 24) || null,
      country_of_origin: text(raw.country_of_origin, 80) || null,
      eta: text(raw.eta, 40) || null,
      shipping_cost: number(raw.shipping_cost, 0, 100_000_000),
      customs_cost: number(raw.customs_cost, 0, 100_000_000),
      accepts_trade_in: raw.accepts_trade_in !== false,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verified = verify(url.searchParams.get("initData") ?? "");
  const supabase = serverClient();
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Dealer portal is not configured" }, { status: 503 });

  const [{ data: account, error: accountError }, { data: inventory, error: inventoryError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase.from("telegram_dealer_accounts").select("*").eq("telegram_user_id", verified.user.id).maybeSingle(),
    supabase.from("market_vehicle_inventory").select("id,make,model,year,price,currency,photo_urls,status,source_payload,created_at").eq("market_country", "RU").eq("source_name", "telegram_dealer").eq("seller_telegram_user_id", verified.user.id).order("created_at", { ascending: false }).limit(250),
    supabase.from("telegram_dealer_leads").select("id,lead_type,buyer_name,buyer_phone,buyer_car,status,created_at,inventory_id").eq("dealer_telegram_user_id", verified.user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (accountError || inventoryError || leadsError) return NextResponse.json({ error: "Dealer data lookup failed" }, { status: 500 });
  return NextResponse.json({ account, inventory: inventory ?? [], leads: leads ?? [] });
}

export async function POST(request: Request) {
  let body: DealerBody;
  try { body = await request.json() as DealerBody; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const verified = verify(body.initData ?? "");
  const supabase = serverClient();
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Dealer portal is not configured" }, { status: 503 });

  if (body.action === "register") {
    const raw = body.account ?? {};
    const role = raw.role === "importer" ? "importer" : "dealer";
    const businessName = text(raw.business_name, 120);
    const city = text(raw.city, 80);
    const phone = text(raw.phone, 32);
    if (!businessName || !city || phone.length < 7) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
    const { data, error } = await supabase.from("telegram_dealer_accounts").upsert({
      telegram_user_id: verified.user.id, market_country: "RU", role, business_name: businessName,
      legal_name: text(raw.legal_name, 160) || null, tax_id: text(raw.tax_id, 20) || null,
      city, phone, inventory_mode: raw.inventory_mode === "csv" ? "csv" : "manual", updated_at: new Date().toISOString(),
    }, { onConflict: "telegram_user_id" }).select("*").single();
    if (error) return NextResponse.json({ error: "Account save failed" }, { status: 500 });
    return NextResponse.json({ account: data });
  }

  const { data: account } = await supabase.from("telegram_dealer_accounts").select("business_name").eq("telegram_user_id", verified.user.id).maybeSingle<{ business_name: string }>();
  if (!account) return NextResponse.json({ error: "Dealer account required" }, { status: 403 });

  if (body.action === "upsert_listing") {
    const listing = normalizeListing(body.listing ?? {}, verified.user.id, account.business_name);
    if (!listing) return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
    const { data, error } = await supabase.from("market_vehicle_inventory").insert(listing).select("id").single();
    if (error) return NextResponse.json({ error: "Listing save failed" }, { status: 500 });
    return NextResponse.json({ listingId: data.id });
  }

  if (body.action === "import_csv") {
    const rawRows = Array.isArray(body.listings) ? body.listings.slice(0, 250) : [];
    const rows = rawRows.flatMap((row) => {
      const normalized = normalizeListing(row, verified.user.id, account.business_name);
      return normalized ? [normalized] : [];
    });
    if (!rows.length) return NextResponse.json({ error: "No valid listings" }, { status: 400 });
    const { error } = await supabase.from("market_vehicle_inventory").insert(rows);
    if (error) return NextResponse.json({ error: "CSV import failed" }, { status: 500 });
    return NextResponse.json({ imported: rows.length, rejected: rawRows.length - rows.length });
  }

  if (body.action === "set_status" && body.listingId && body.availability && AVAILABILITY.has(body.availability)) {
    const { data: current } = await supabase.from("market_vehicle_inventory").select("source_payload").eq("id", body.listingId).eq("seller_telegram_user_id", verified.user.id).eq("source_name", "telegram_dealer").maybeSingle<{ source_payload: Record<string, unknown> }>();
    if (!current) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    const status = body.availability === "sold" ? "sold" : body.availability === "reserved" ? "paused" : "active";
    const { error } = await supabase.from("market_vehicle_inventory").update({ status, source_payload: { ...current.source_payload, availability: body.availability } }).eq("id", body.listingId).eq("seller_telegram_user_id", verified.user.id);
    if (error) return NextResponse.json({ error: "Status update failed" }, { status: 500 });
    return NextResponse.json({ updated: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

