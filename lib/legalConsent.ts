import { LEGAL_VERSION } from "./legalContent";
// Temporary self-reported metadata only, not immutable evidence or authorization.
export function legalConsentMetadata(accepted: boolean, marketing: boolean, now = new Date()) {
 if (accepted !== true) throw new Error("יש לאשר את הסכם המנוי ותנאי השימוש לפני הרשמה.");
 return { terms_version: LEGAL_VERSION, accepted_at: now.toISOString(), marketing_consent: marketing === true, marketing_consent_at: marketing === true ? now.toISOString() : null };
}
