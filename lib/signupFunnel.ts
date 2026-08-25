import { track } from "@vercel/analytics";

export type SignupFunnelEvent =
  | "dealer_join_view"
  | "dealer_signup_cta_click"
  | "dealer_signup_form_view"
  | "dealer_signup_submit_attempt"
  | "dealer_signup_submit_success"
  | "dealer_signup_submit_failure"
  | "dealer_signup_email_confirmation_pending"
  | "dealer_signup_complete";

type FunnelProperties = Record<string, string | number | boolean | null>;

/** Funnel telemetry must stay best-effort and must never contain customer PII. */
export function trackSignupFunnel(event: SignupFunnelEvent, properties?: FunnelProperties) {
  try {
    track(event, properties);
  } catch {
    // Analytics must never interrupt signup, including when blocked by a browser.
  }
}
