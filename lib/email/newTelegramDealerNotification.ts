type TelegramDealerAlert = {
  telegramUserId: number;
  role: "dealer" | "importer";
  businessName: string;
  legalName: string | null;
  taxId: string | null;
  city: string;
  phone: string;
};

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function sendNewTelegramDealerNotification(dealer: TelegramDealerAlert) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not-configured" } as const;
  const destination = process.env.NEW_CUSTOMER_ALERT_TO ?? "info@switchapp.co.il";
  const from = process.env.NEW_CUSTOMER_FROM ?? "SwitchApp <notifications@updates.switchapp.co.il>";
  const role = dealer.role === "importer" ? "יבואן" : "סוחר / מגרש";
  const fields = [
    ["עסק", dealer.businessName], ["סוג", role], ["שם משפטי", dealer.legalName ?? "—"],
    ["ИНН", dealer.taxId ?? "—"], ["עיר", dealer.city], ["טלפון", dealer.phone],
    ["Telegram ID", String(dealer.telegramUserId)],
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `telegram-dealer-${dealer.telegramUserId}` },
    body: JSON.stringify({
      from, to: [destination], subject: `סוחר חדש מרוסיה ב־SwitchApp: ${dealer.businessName}`,
      text: ["נרשם חשבון B2B חדש דרך Telegram", ...fields.map(([label, value]) => `${label}: ${value}`)].join("\n"),
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2 style="color:#013b7b">נרשם חשבון B2B חדש דרך Telegram</h2><table style="width:100%;border-collapse:collapse"><tbody>${fields.map(([label, value]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(label)}</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(value)}</strong></td></tr>`).join("")}</tbody></table><p style="margin-top:18px"><a href="https://www.switchapp.co.il/admin">פתיחת מסך הניהול</a></p></div>`,
    }),
  });
  if (!response.ok) {
    console.error("Telegram dealer email failed", response.status, (await response.text()).slice(0, 300));
    return { sent: false, reason: "provider-error" } as const;
  }
  return { sent: true } as const;
}

