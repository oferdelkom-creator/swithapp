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
    from?: { id: number; first_name: string };
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

async function sendBotMessage(botToken: string, chatId: number, text: string, appUrl?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: appUrl
        ? { inline_keyboard: [[{ text: "Открыть SwitchApp", web_app: { url: appUrl } }]] }
        : undefined,
    }),
  });
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!botToken || !webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secretsMatch(receivedSecret, webhookSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  if (message.text?.startsWith("/start")) {
    const firstName = message.from?.first_name ?? "друг";
    const appUrl = process.env.TELEGRAM_MINI_APP_URL ?? `${SITE_URL}/telegram`;
    await sendBotMessage(
      botToken,
      message.chat.id,
      `Привет, ${firstName}! 🚗\n\nSwitchApp подбирает автомобили свайпами. Первые 1000 участников получают Founder-доступ бесплатно.`,
      appUrl
    );
  }

  const payment = message.successful_payment;
  if (payment && payment.currency === "XTR" && secretKey) {
    try {
      const payload = JSON.parse(payment.invoice_payload) as { productId?: string; telegramUserId?: number; marketCountry?: string };
      if (
        payload.productId &&
        isTelegramProductId(payload.productId) &&
        payload.marketCountry === "RU" &&
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
        if (recorded) await sendBotMessage(botToken, message.chat.id, "Оплата получена. Доступ активирован ✅");
      }
    } catch {
      // Telegram retries non-2xx webhooks. A malformed, already-paid payload is
      // acknowledged here; valid payments remain idempotent in Postgres.
    }
  }

  return NextResponse.json({ ok: true });
}
