import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dealerSignupDraft } from "@/lib/signupAuth";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "strict-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Content-Type": "text/html; charset=utf-8",
};
const validToken = (v: unknown): v is string => typeof v === "string" && /^(?:pkce_)?[a-f0-9]{40,128}$(?![\s\S])/i.test(v);
function page(message: string, form = "", status = 200) {
  return new NextResponse(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>אימות מייל | SwitchApp</title><body style="font-family:Arial;max-width:560px;margin:60px auto;padding:24px"><h1>SwitchApp</h1><p>${message}</p>${form}<p><a href="/login">חזרה להתחברות</a></p></body></html>`, { status, headers });
}
// GET deliberately does not verify or consume the one-use token (email link scanners).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  if (!validToken(token)) return page("הקישור אינו תקין. אפשר לחזור להתחברות או לבקש קישור חדש.", "", 400);
  return page("ברוכים הבאים. לחצו כדי לאמת את כתובת המייל ולהמשיך באתר. אפשר לפתוח את הקישור גם במכשיר אחר.", `<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${token}"><button type="submit">אימות המייל והמשך</button></form>`);
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return page("הבקשה נחסמה. פתחו מחדש את הקישור מהמייל.", "", 403);
  const form = await request.formData();
  const token = form.get("token_hash");
  if (!validToken(token)) return page("הקישור אינו תקין.", "", 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "email" });
    if (error || !data.user || !data.session) return page("הקישור פג תוקף או כבר שומש. אם כבר אימתתם את המייל, התחברו עם הסיסמה. לא נשלח קישור נוסף אוטומטית.", "", 400);
    let next = "/";
    if (data.user.user_metadata?.dealer_signup) {
      try { dealerSignupDraft(data.user.user_metadata.dealer_signup); next = "/business/join/finish"; }
      catch { return page("המייל אומת, אך פרטי העסק אינם תקינים. התחברו ופנו לתמיכה לפני ניסיון נוסף.", "", 400); }
    }
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return page("לא ניתן לאשר את תוצאת האימות. אין ללחוץ שוב אוטומטית. נסו להתחבר עם הסיסמה או פנו לתמיכה.", "", 503); }
}
