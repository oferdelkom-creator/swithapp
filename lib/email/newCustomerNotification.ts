import type { User } from "@supabase/supabase-js";

export type CustomerProfile = {
  name: string;
  role: "private" | "dealer" | "importer";
  business_name: string | null;
  dealer_slug: string | null;
  created_at: string;
  is_seed: boolean;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function roleLabel(role: CustomerProfile["role"]) {
  if (role === "dealer") return "מגרש / סוחר רכב";
  if (role === "importer") return "יבואן רכב";
  return "לקוח פרטי";
}

export async function sendNewCustomerNotification(user: User, profile: CustomerProfile | null) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !profile || profile.is_seed) return { sent: false, reason: "not-configured-or-ineligible" } as const;

  const createdAt = new Date(profile.created_at);
  if (!Number.isFinite(createdAt.getTime()) || Date.now() - createdAt.getTime() > FIFTEEN_MINUTES) {
    return { sent: false, reason: "not-new" } as const;
  }

  const destination = process.env.NEW_CUSTOMER_ALERT_TO ?? "info@switchapp.co.il";
  const from = process.env.NEW_CUSTOMER_FROM ?? "SwitchApp <notifications@updates.switchapp.co.il>";
  const name = profile.name || "ללא שם";
  const contact = user.email ?? user.phone ?? "לא נמסר";
  const business = profile.business_name ?? "—";
  const registeredAt = createdAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `new-customer-${user.id}`,
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: `לקוח חדש ב־SwitchApp: ${name}`,
      text: ["נרשם לקוח חדש ל־SwitchApp", `שם: ${name}`, `סוג חשבון: ${roleLabel(profile.role)}`, `אימייל / טלפון: ${contact}`, `שם העסק: ${business}`, `כתובת המגרש: ${profile.dealer_slug ?? "—"}`, `מועד הרשמה: ${registeredAt}`, `מזהה לקוח: ${user.id}`].join("\n"),
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2 style="color:#013b7b">נרשם לקוח חדש ל־SwitchApp</h2><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="padding:8px;border-bottom:1px solid #eee">שם</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(name)}</strong></td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">סוג חשבון</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(roleLabel(profile.role))}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">אימייל / טלפון</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(contact)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">שם העסק</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(business)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">כתובת המגרש</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(profile.dealer_slug ?? "—")}</td></tr><tr><td style="padding:8px">מועד הרשמה</td><td style="padding:8px">${escapeHtml(registeredAt)}</td></tr></tbody></table><p style="margin-top:20px;font-size:12px;color:#667085">מזהה לקוח: ${escapeHtml(user.id)}</p></div>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("New customer email failed", response.status, details.slice(0, 300));
    return { sent: false, reason: "provider-error" } as const;
  }
  return { sent: true } as const;
}
