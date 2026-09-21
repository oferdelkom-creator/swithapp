import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { TELEGRAM_PRODUCTS } from "@/lib/telegram/products";
import { validateTelegramInitData } from "@/lib/telegram/validateInitData";

interface ListingBody {
  initData?: string;
  marketCountry?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  photoUrl?: string;
  city?: string;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!botToken || !secretKey) return NextResponse.json({ error: "Listings are not configured" }, { status: 503 });

  let body: ListingBody;
  try {
    body = (await request.json()) as ListingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const verified = validateTelegramInitData(body.initData ?? "", botToken, 60 * 60, process.env.TELEGRAM_BOT_ID ?? "8875971815");
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  const market = body.marketCountry === "IL" ? "IL" : body.marketCountry === "RU" ? "RU" : null;
  if (!market) return NextResponse.json({ error: "Invalid market" }, { status: 400 });

  const make = cleanText(body.make, 60);
  const model = cleanText(body.model, 80);
  const city = cleanText(body.city, 80);
  const year = Number(body.year);
  const price = Number(body.price);
  if (!make || !model || !city || !Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1 || !Number.isFinite(price) || price < 10000 || price > 1000000000) {
    return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
  }
  let photoUrl: string | null = null;
  if (body.photoUrl) {
    try {
      const parsed = new URL(body.photoUrl);
      if (parsed.protocol !== "https:") throw new Error("invalid_protocol");
      photoUrl = parsed.toString().slice(0, 1000);
    } catch {
      return NextResponse.json({ error: "Invalid photo URL" }, { status: 400 });
    }
  }

  const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { count, error: countError } = await supabase
    .from("market_vehicle_inventory")
    .select("id", { count: "exact", head: true })
    .eq("market_country", market)
    .eq("seller_telegram_user_id", verified.user.id);
  if (countError) return NextResponse.json({ error: "Listing lookup failed" }, { status: 500 });

  const isFree = (count ?? 0) === 0;
  const sourceListingId = randomUUID();
  const { data: listing, error: insertError } = await supabase
    .from("market_vehicle_inventory")
    .insert({
      market_country: market,
      source_name: "telegram_user",
      source_listing_id: sourceListingId,
      seller_telegram_user_id: verified.user.id,
      seller_name: verified.user.first_name,
      make,
      model,
      year,
      price: Math.round(price),
      currency: market === "IL" ? "ILS" : "RUB",
      photo_urls: photoUrl ? [photoUrl] : [],
      status: isFree ? "active" : "paused",
      source_payload: { city, telegram_username: verified.user.username ?? null },
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !listing) return NextResponse.json({ error: "Listing creation failed" }, { status: 500 });
  if (isFree) return NextResponse.json({ published: true, free: true, listingId: listing.id });

  const product = TELEGRAM_PRODUCTS.seller_listing;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    try {
      const registration = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://www.switchapp.co.il/api/telegram/webhook",
          secret_token: webhookSecret,
          allowed_updates: ["message", "pre_checkout_query"],
        }),
        cache: "no-store",
      });
      const registered = await registration.json() as { ok?: boolean };
      if (!registration.ok || !registered.ok) return NextResponse.json({ error: "Payments temporarily unavailable" }, { status: 503 });
    } catch {
      return NextResponse.json({ error: "Payments temporarily unavailable" }, { status: 503 });
    }
  }
  if (!webhookSecret) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  const invoiceResponse = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: product.title,
      description: product.description,
      payload: JSON.stringify({ p: "seller_listing", u: verified.user.id, m: market, l: listing.id }),
      currency: "XTR",
      prices: [{ label: product.title, amount: product.stars }],
    }),
  });
  const invoice = (await invoiceResponse.json()) as { ok: boolean; result?: string; description?: string };
  if (!invoice.ok || !invoice.result) {
    await supabase.from("market_vehicle_inventory").delete().eq("id", listing.id).eq("seller_telegram_user_id", verified.user.id);
    return NextResponse.json({ error: invoice.description ?? "Invoice creation failed" }, { status: 502 });
  }
  return NextResponse.json({ published: false, free: false, listingId: listing.id, invoiceUrl: invoice.result, stars: product.stars });
}

