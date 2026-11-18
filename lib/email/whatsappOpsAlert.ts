function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// Alert the team when WhatsApp replies could not be confirmed delivered (resolved as
// 'send_unconfirmed'), so a person can check and follow up. Best-effort.
export async function sendWhatsappStuckAlert(rows: { message_sid: string; phone_e164: string }[]): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || rows.length === 0) return { sent: false };

  const destination = process.env.NEW_CUSTOMER_ALERT_TO ?? "info@switchapp.co.il";
  const from = process.env.NEW_CUSTOMER_FROM ?? "SwitchApp <notifications@updates.switchapp.co.il>";
  const when = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const list = rows.slice(0, 50).map((r) => `${r.phone_e164} (${r.message_sid})`);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Dedupe by the exact set of message ids resolved in this sweep.
        "Idempotency-Key": `wa-stuck-${rows.map((r) => r.message_sid).sort().join(",")}`.slice(0, 250),
      },
      body: JSON.stringify({
        from,
        to: [destination],
        subject: `WhatsApp: ${rows.length} הודעות ללא אישור מסירה`,
        text: [
          `${rows.length} הודעות WhatsApp נוסו להישלח אך לא אושרו כנמסרו (send_unconfirmed).`,
          "כדאי לבדוק שהלקוחות קיבלו מענה, ולחזור אליהם אם לא.",
          `מועד: ${when}`,
          "",
          ...list,
        ].join("\n"),
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2 style="color:#013b7b">WhatsApp — הודעות ללא אישור מסירה</h2><p>${rows.length} הודעות נוסו להישלח אך לא אושרו כנמסרו (<code>send_unconfirmed</code>). כדאי לבדוק שהלקוחות קיבלו מענה.</p><p style="color:#667085;font-size:13px">מועד: ${escapeHtml(when)}</p><ul>${list.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`,
      }),
    });
    if (!response.ok) {
      console.error("WhatsApp stuck alert email failed", response.status, (await response.text()).slice(0, 300));
      return { sent: false };
    }
    return { sent: true };
  } catch {
    return { sent: false };
  }
}
