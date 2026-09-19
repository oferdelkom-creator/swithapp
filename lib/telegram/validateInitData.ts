import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifiedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedTelegramInitData {
  user: VerifiedTelegramUser;
  authDate: Date;
  startParam: string | null;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60
): VerifiedTelegramInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) return null;

  params.delete("hash");
  // `signature` is Telegram's separate Ed25519 proof for third-party
  // validation. It is not part of the bot-token HMAC data-check-string.
  params.delete("signature");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const receivedHash = Buffer.from(suppliedHash, "hex");
  if (receivedHash.length !== expectedHash.length || !timingSafeEqual(receivedHash, expectedHash)) return null;

  const authDateSeconds = Number(params.get("auth_date"));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds > nowSeconds + 30) return null;
  if (nowSeconds - authDateSeconds > maxAgeSeconds) return null;

  const userValue = params.get("user");
  if (!userValue) return null;

  try {
    const user = JSON.parse(userValue) as VerifiedTelegramUser;
    if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.first_name) return null;
    return {
      user,
      authDate: new Date(authDateSeconds * 1000),
      startParam: params.get("start_param"),
    };
  } catch {
    return null;
  }
}
