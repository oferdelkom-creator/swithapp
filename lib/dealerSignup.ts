import { createClient } from "@/lib/supabase/client";

// Shared by DealerJoinForm (immediate case - email confirmation is off, a session
// exists right after signUp) and the /business/join/finish page (the confirmation-
// link round trip case) so the "turn this brand-new account into a pending dealer"
// step exists once. role/billing_plan aren't in protect_privileged_user_columns()'s
// admin-only list, so a plain client update works; subscription_valid_until is
// admin-only and stays null here - that's what marks the account as pending until our
// team activates payment (see ActivateSubscriptionButton in /admin).
export async function finishDealerSignup(
  supabase: ReturnType<typeof createClient>,
  params: { userId: string; businessName: string; cap: number | null; phone: string }
) {
  const { userId, businessName, cap, phone } = params;

  await supabase
    .from("users")
    .update({
      role: "dealer",
      business_name: businessName,
      billing_plan: "subscription",
      requested_car_cap: cap,
    })
    .eq("id", userId);

  if (phone.trim()) {
    // Best-effort - a duplicate phone (unique constraint) shouldn't block the signup.
    await supabase.from("user_contacts").upsert({ user_id: userId, phone: phone.trim() });
  }
}
