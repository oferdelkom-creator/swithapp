import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";

const TELEGRAM_PRODUCTION_PUBLIC_KEY = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
const ED25519_SPKI_PREFIX = "302a300506032b6570032100";

function verifyTelegramSignature(params: URLSearchParams, signature: string | null, botId: string | undefined) {
  if (!signature || !botId || !/^\d+$/.test(botId)) return false;
  try {
    const values = [...params.entries()]
      .filter(([key]) => key !== "hash" && key !== "signature")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const dataCheckString = `${botId}:WebAppData\n${values}`;
    const publicKey = createPublicKey({
      key: Buffer.from(`${ED25519_SPKI_PREFIX}${TELEGRAM_PRODUCTION_PUBLIC_KEY}`, "hex"),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(dataCheckString), publicKey, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

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
  maxAgeSeconds = 60 * 60,
  botId?: string
): VerifiedTelegramInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  const suppliedSignature = params.get("signature");
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
  const dataCheckStringWithSignature = [...new URLSearchParams(initData).entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const expectedHashWithSignature = createHmac("sha256", secretKey).update(dataCheckStringWithSignature).digest();
  const receivedHash = Buffer.from(suppliedHash, "hex");
  const validBotHash = receivedHash.length === expectedHash.length && (
    timingSafeEqual(receivedHash, expectedHash) || timingSafeEqual(receivedHash, expectedHashWithSignature)
  );
  const validPublicSignature = verifyTelegramSignature(new URLSearchParams(initData), suppliedSignature, botId);
  if (!validBotHash && !validPublicSignature) {
    console.warn(JSON.stringify({
      route: "telegram_init_data_validation",
      botId,
      tokenBotId: botToken.split(":", 1)[0],
      suppliedHash,
      expectedHash: expectedHash.toString("hex"),
      expectedHashWithSignature: expectedHashWithSignature.toString("hex"),
      hasSignature: Boolean(suppliedSignature),
      initDataLength: initData.length,
    }));
    return null;
  }

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

