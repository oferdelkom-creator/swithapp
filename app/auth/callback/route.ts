import { NextResponse, type NextRequest } from "next/server";
import { safeAuthNext } from "@/lib/signupAuth";
import { createClient } from "@/lib/supabase/server";
import { sendNewCustomerNotification, type CustomerProfile } from "@/lib/email/newCustomerNotification";

// Supabase OAuth (Google, etc.) redirects here with a ?code= to exchange for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthNext(searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/auth/confirm", origin));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/auth/confirm", origin));
    if (!next.startsWith("/business/join/finish")) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("users").select("name, role, business_name, dealer_slug, created_at, is_seed").eq("id", user.id).maybeSingle<CustomerProfile>();
        await sendNewCustomerNotification(user, profile);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
