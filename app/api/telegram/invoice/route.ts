import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isTelegramProductId, TELEGRAM_PRODUCTS } from "@/lib/telegram/products";
import { validateTelegramInitData } from "@/lib/telegram/validateInitData";

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!botToken || !secretKey) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });

  let body: { initData?: string; productId?: string; marketCountry?: string };
  try {
    body = (await request.json()) as { initData?: string; productId?: string; marketCountry?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = validateTelegramInitData(body.initData ?? "", botToken, 60 * 60, process.env.TELEGRAM_BOT_ID ?? "8875971815");
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  const market = body.marketCountry === "IL" ? "IL" : body.marketCountry === "RU" ? "RU" : null;
  if (!market) return NextResponse.json({ error: "Invalid market" }, { status: 400 });
  if (!body.productId || !isTelegramProductId(body.productId)) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  if (body.productId === "seller_listing") return NextResponse.json({ error: "Create a listing before paying" }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: pilotUser } = await supabase
    .from("telegram_pilot_users")
    .select("founder_number")
    .eq("telegram_user_id", verified.user.id)
    .eq("market_country", market)
    .maybeSingle<{ founder_number: number | null }>();

  if (!pilotUser) return NextResponse.json({ error: "Complete pilot registration first" }, { status: 404 });

  if (pilotUser?.founder_number && body.productId === "buyer_plus_30d") {
    return NextResponse.json({ error: "Founder access is already free" }, { status: 409 });
  }

  const product = TELEGRAM_PRODUCTS[body.productId];
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
      payload: JSON.stringify({ productId: body.productId, telegramUserId: verified.user.id, marketCountry: market }),
      currency: "XTR",
      prices: [{ label: product.title, amount: product.stars }],
    }),
  });
  const invoice = (await invoiceResponse.json()) as { ok: boolean; result?: string; description?: string };
  if (!invoiceResponse.ok || !invoice.ok || !invoice.result) {
    return NextResponse.json({ error: invoice.description ?? "Invoice creation failed" }, { status: 502 });
  }
  return NextResponse.json({ invoiceUrl: invoice.result });
}

