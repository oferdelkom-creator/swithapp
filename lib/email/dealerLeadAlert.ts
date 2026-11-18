function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// Proactive human handoff for a dealer captured over WhatsApp: email the team so a person
// follows up. Best-effort — returns { sent:false } when Resend is not configured or errors.
export async function sendDealerLeadAlert(lead: { phone: string; businessName: string; city: string | null }): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const destination = process.env.NEW_CUSTOMER_ALERT_TO ?? "info@switchapp.co.il";
  const from = process.env.NEW_CUSTOMER_FROM ?? "SwitchApp <notifications@updates.switchapp.co.il>";
  const name = lead.businessName || "—";
  const city = lead.city || "—";
  const when = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `wa-dealer-lead-${lead.phone}`,
      },
      body: JSON.stringify({
        from,
        to: [destination],
        subject: `ליד סוחר חדש מ־WhatsApp: ${name}`,
        text: [
          "התקבל ליד סוחר חדש דרך בוט ה־WhatsApp.",
          `שם העסק / מגרש: ${name}`,
          `עיר: ${city}`,
          `טלפון (WhatsApp): ${lead.phone}`,
          `מועד: ${when}`,
          "לטיפול: צרו קשר עם הסוחר להשלמת ההרשמה.",
        ].join("\n"),
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2 style="color:#013b7b">ליד סוחר חדש מ־WhatsApp</h2><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="padding:8px;border-bottom:1px solid #eee">שם העסק / מגרש</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(name)}</strong></td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">עיר</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(city)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">טלפון (WhatsApp)</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(lead.phone)}</td></tr><tr><td style="padding:8px">מועד</td><td style="padding:8px">${escapeHtml(when)}</td></tr></tbody></table><p style="margin-top:20px;font-size:13px">לטיפול: צרו קשר עם הסוחר להשלמת ההרשמה.</p></div>`,
      }),
    });
    if (!response.ok) {
      console.error("Dealer lead email failed", response.status, (await response.text()).slice(0, 300));
      return { sent: false };
    }
    return { sent: true };
  } catch {
    return { sent: false };
  }
}
