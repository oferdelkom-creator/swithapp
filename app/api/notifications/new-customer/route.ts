import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNewCustomerNotification, type CustomerProfile } from "@/lib/email/newCustomerNotification";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("name, role, business_name, dealer_slug, created_at, is_seed").eq("id", user.id).maybeSingle<CustomerProfile>();
  const result = await sendNewCustomerNotification(user, profile);
  return NextResponse.json({ ok: true, sent: result.sent });
}
