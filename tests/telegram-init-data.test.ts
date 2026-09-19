import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
// Node's built-in TypeScript stripping requires the explicit extension.
// @ts-expect-error The production compiler resolves this same TypeScript module.
import { validateTelegramInitData } from "../lib/telegram/validateInitData.ts";

const botToken = "123456789:test-token";

function signedInitData(extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "test-query",
    user: JSON.stringify({ id: 2046887984, first_name: "SwitchApp", language_code: "he" }),
    ...extra,
  });
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

test("validates current Telegram initData while ignoring the Ed25519 signature field", () => {
  const result = validateTelegramInitData(signedInitData({ signature: "telegram-ed25519-signature" }), botToken);
  assert.equal(result?.user.id, 2046887984);
});

test("rejects tampered Telegram initData", () => {
  const initData = new URLSearchParams(signedInitData({ signature: "telegram-ed25519-signature" }));
  initData.set("user", JSON.stringify({ id: 1, first_name: "Attacker" }));
  assert.equal(validateTelegramInitData(initData.toString(), botToken), null);
});
