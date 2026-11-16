import { dealerSignupDraft } from "./signupAuth";
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
  params: {
    userId: string;
    businessName: string;
    cap: number | null;
    phone: string;
    role: "dealer" | "importer";
    dealerSlug: string;
    customDomain: string | null;
  }
) {
  const { userId } = params;
  const { businessName, cap, phone, role, dealerSlug, customDomain } = dealerSignupDraft(params);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) throw new Error("Authentication required");
  const { data: existing, error: profileError } = await supabase.from("users")
    .select("id, role, is_admin").eq("id", userId).maybeSingle();
  if (profileError || !existing || existing.is_admin) throw new Error("Profile requires review");
  // Reopening a confirmation must not reset an existing dealer's plan/domain.
  if (existing.role === "dealer" || existing.role === "importer") return;
  if (existing.role !== "private") throw new Error("Profile requires review");

  const { data: updated, error } = await supabase
    .from("users")
    .update({
      role,
      business_name: businessName,
      billing_plan: cap === 1 ? "per_listing" : "subscription",
      requested_car_cap: cap,
      dealer_slug: dealerSlug,
      custom_domain: customDomain,
      custom_domain_active: false,
    })
    .eq("id", userId).eq("role", "private").eq("is_admin", false).select("id").maybeSingle();
  if (error || !updated) throw new Error("Signup completion requires review");

  if (phone.trim()) {
    // Best-effort - a duplicate phone (unique constraint) shouldn't block the signup.
    await supabase.from("user_contacts").upsert({ user_id: userId, phone: phone.trim() });
  }
}
