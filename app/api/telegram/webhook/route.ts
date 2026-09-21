import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/constants";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isTelegramProductId, TELEGRAM_PRODUCTS } from "@/lib/telegram/products";

interface TelegramUpdate {
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
  message?: {
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name: string; language_code?: string };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
}

function secretsMatch(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendBotMessage(botToken: string, chatId: number, text: string, appUrl?: string, buttonText = "Открыть SwitchApp") {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: appUrl
        ? { inline_keyboard: [[{ text: buttonText, web_app: { url: appUrl } }]] }
        : undefined,
    }),
  });
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!botToken || !webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secretsMatch(receivedSecret, webhookSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let update: TelegramUpdate;
  try { update = await request.json() as TelegramUpdate; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const checkout = update.pre_checkout_query;
  if (checkout) {
    let approved = false;
    let reason = "Не удалось проверить заказ. Откройте приложение и попробуйте снова.";
    try {
      const raw = JSON.parse(checkout.invoice_payload);
      const productId = raw?.productId ?? raw?.p;
      const userId = raw?.telegramUserId ?? raw?.u;
      const market = raw?.marketCountry ?? raw?.m;
      const listingId = raw?.listingId ?? raw?.l;
      if (secretKey && typeof productId === "string" && isTelegramProductId(productId)
          && checkout.currency === "XTR" && checkout.total_amount === TELEGRAM_PRODUCTS[productId].stars
          && Number.isSafeInteger(userId) && userId === checkout.from.id
          && (market === "RU" || market === "IL")) {
        const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: buyer, error } = await supabase.from("telegram_pilot_users")
          .select("founder_number").eq("telegram_user_id", userId).eq("market_country", market)
          .maybeSingle<{ founder_number: number | null }>();
        if (!error && buyer) {
          approved = true;
          if (productId === "buyer_plus_30d" && buyer.founder_number) {
            approved = false;
            reason = "Founder-доступ уже предоставлен бесплатно.";
          }
          if (productId === "seller_listing") {
            approved = false;
            if (typeof listingId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)) {
              const { data: listing, error: listingError } = await supabase.from("market_vehicle_inventory")
                .select("id").eq("id", listingId).eq("seller_telegram_user_id", userId)
                .eq("market_country", market).eq("status", "paused")
                .is("listing_payment_charge_id", null).maybeSingle();
              approved = !listingError && !!listing;
            }
          }
        }
      }
    } catch { approved = false; }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: checkout.id, ok: approved,
          ...(approved ? {} : { error_message: reason }) }),
        signal: AbortSignal.timeout(3000),
      });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || !result.ok) return NextResponse.json({ error: "Checkout response failed" }, { status: 502 });
    } catch { return NextResponse.json({ error: "Checkout response failed" }, { status: 502 }); }
    return NextResponse.json({ ok: true });
  }
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  if (message.text?.startsWith("/start")) {
    const firstName = message.from?.first_name ?? "друг";
    const startArgument = message.text.trim().split(/\s+/)[1]?.toLowerCase();
    // The public bot targets Russia; Israel remains an explicit opt-in.
    const isHebrew = startArgument === "il";
    const market = isHebrew ? "IL" : "RU";
    const baseAppUrl = process.env.TELEGRAM_MINI_APP_URL ?? `${SITE_URL}/telegram`;
    const destination = new URL(baseAppUrl);
    destination.searchParams.set("market", market);
    const appUrl = destination.toString();
    await sendBotMessage(
      botToken,
      message.chat.id,
      isHebrew
        ? `שלום ${firstName}! 🚗\n\nSwitchApp עוזרת למצוא רכב בהחלקות. 1,000 המצטרפים הראשונים מקבלים גישת Founder בחינם.`
        : `Привет, ${firstName}! 🚗\n\nSwitchApp подбирает автомобили свайпами. Первые 1000 участников получают Founder-доступ бесплатно.`,
      appUrl,
      isHebrew ? "פתיחת SwitchApp" : "Открыть SwitchApp"
    );
  }

  if (/^\/(paysupport|support)(?:@\w+)?(?:\s|$)/.test(message.text ?? "")) {
    await sendBotMessage(botToken, message.chat.id, "Вопросы об оплате и возврате: @delkom. Укажите продукт и приложите квитанцию Telegram. Поддержку по покупкам оказывает SwitchApp.");
  }

  const payment = message.successful_payment;
  if (payment && !secretKey) return NextResponse.json({ error: "Payment storage unavailable" }, { status: 503 });
  if (payment && payment.currency === "XTR" && secretKey) {
    try {
      const rawPayload = JSON.parse(payment.invoice_payload) as {
        productId?: string; telegramUserId?: number; marketCountry?: string; listingId?: string;
        p?: string; u?: number; m?: string; l?: string;
      };
      const payload = {
        productId: rawPayload.productId ?? rawPayload.p,
        telegramUserId: rawPayload.telegramUserId ?? rawPayload.u,
        marketCountry: rawPayload.marketCountry ?? rawPayload.m,
        listingId: rawPayload.listingId ?? rawPayload.l,
      };
      if (
        typeof payload.productId === "string" &&
        isTelegramProductId(payload.productId) &&
        payment.total_amount === TELEGRAM_PRODUCTS[payload.productId].stars &&
        (payload.marketCountry === "RU" || payload.marketCountry === "IL") &&
        Number.isSafeInteger(payload.telegramUserId) &&
        message.from?.id === payload.telegramUserId
      ) {
        const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: recorded, error: recordError } = await supabase.rpc("record_telegram_stars_payment", {
          p_telegram_user_id: payload.telegramUserId,
          p_charge_id: payment.telegram_payment_charge_id,
          p_product_id: payload.productId,
          p_stars: payment.total_amount,
          p_market_country: payload.marketCountry,
        });
        if (recordError) return NextResponse.json({ error: "Payment storage failed" }, { status: 503 });
        // Retry delivery even when the charge was recorded by an earlier attempt.
        if (payload.productId === "seller_listing" && payload.listingId) {
          const { error: deliveryError } = await supabase
            .from("market_vehicle_inventory")
            .update({ status: "active", listing_payment_charge_id: payment.telegram_payment_charge_id, updated_at: new Date().toISOString() })
            .eq("id", payload.listingId)
            .eq("seller_telegram_user_id", payload.telegramUserId)
            .eq("status", "paused");
          if (deliveryError) return NextResponse.json({ error: "Payment delivery failed" }, { status: 503 });
          await sendBotMessage(botToken, message.chat.id, "Оплата получена. Автомобиль опубликован ✅");
        } else if (recorded) {
          await sendBotMessage(botToken, message.chat.id, "Оплата получена. Доступ активирован ✅");
        }
      }
    } catch {
      return NextResponse.json({ error: "Payment processing failed" }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}

