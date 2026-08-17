// Normalizes an Israeli local number ("050-1234567", "0501234567") or an
// already-international one ("+972501234567") into E.164 for Supabase's phone auth.
export function toE164Israel(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

// wa.me links want the E.164 number with no leading "+".
export function toWhatsAppLink(raw: string): string {
  return `https://wa.me/${toE164Israel(raw).slice(1)}`;
}
