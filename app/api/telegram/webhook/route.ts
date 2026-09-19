import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/constants";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { isTelegramProductId } from "@/lib/telegram/products";

interface TelegramUpdate {
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

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  if (message.text?.startsWith("/start")) {
    const firstName = message.from?.first_name ?? "друг";
    const isHebrew = message.from?.language_code === "he";
    const market = isHebrew ? "IL" : "RU";
    const baseAppUrl = process.env.TELEGRAM_MINI_APP_URL ?? `${SITE_URL}/telegram`;
    const appUrl = `${baseAppUrl}${baseAppUrl.includes("?") ? "&" : "?"}market=${market}`;
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

  const payment = message.successful_payment;
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
        payload.productId &&
        isTelegramProductId(payload.productId) &&
        (payload.marketCountry === "RU" || payload.marketCountry === "IL") &&
        Number.isSafeInteger(payload.telegramUserId) &&
        message.from?.id === payload.telegramUserId
      ) {
        const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: recorded } = await supabase.rpc("record_telegram_stars_payment", {
          p_telegram_user_id: payload.telegramUserId,
          p_charge_id: payment.telegram_payment_charge_id,
          p_product_id: payload.productId,
          p_stars: payment.total_amount,
          p_market_country: payload.marketCountry,
        });
        if (recorded && payload.productId === "seller_listing" && payload.listingId) {
          await supabase
            .from("market_vehicle_inventory")
            .update({ status: "active", listing_payment_charge_id: payment.telegram_payment_charge_id, updated_at: new Date().toISOString() })
            .eq("id", payload.listingId)
            .eq("seller_telegram_user_id", payload.telegramUserId)
            .eq("status", "paused");
          await sendBotMessage(botToken, message.chat.id, "Оплата получена. Автомобиль опубликован ✅");
        } else if (recorded) {
          await sendBotMessage(botToken, message.chat.id, "Оплата получена. Доступ активирован ✅");
        }
      }
    } catch {
      // Telegram retries non-2xx webhooks. A malformed, already-paid payload is
      // acknowledged here; valid payments remain idempotent in Postgres.
    }
  }

  return NextResponse.json({ ok: true });
}
