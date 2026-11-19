import { explicitPlateRequest } from './assistant';
import { formatPlateLookup, lookupOfficialPlate } from './plateLookup';

export function plateConfirmation(locale: string): string {
 const text = { he: 'כדי שאחפש בשני המאגרים, שלח את המספר עם הכיתוב ״מספר רישוי״ לפניו.', en: 'To check listings and the Ministry registry, send: registration: followed by the plate number.', ru: 'Чтобы проверить объявления и реестр, отправьте: номер авто: и затем номер.', ar: 'لفحص الإعلانات وسجل الوزارة، أرسل: لوحة: ثم الرقم.' };
 return text[locale as keyof typeof text] ?? text.he;
}
export function barePlateCandidate(text: string): boolean {
 return /^[0-9][0-9 -]*[0-9]$/.test(text.trim()) && /^\d{7,8}$/.test(text.trim().replace(/[ -]/g,''));
}
// Called only after website auth/visitor+rate checks, or WhatsApp owned history/rate gate.
// Do not infer consent from browser-supplied assistant history. Bare numbers always require labeled resend.
export async function plateConversation(input: { text: string; locale: string; disabled?: boolean; lookup: (plate: string) => Promise<{ data: Record<string,unknown>[] | null; error: unknown }>; official?: typeof lookupOfficialPlate }): Promise<string | null> {
 if (input.disabled) return null;
 const plate = explicitPlateRequest(input.text);
 if (!plate) return barePlateCandidate(input.text) ? plateConfirmation(input.locale) : null;
 const [internal, registry] = await Promise.all([
  Promise.resolve().then(()=>input.lookup(plate)).catch(()=>({data:null,error:true})),
  (input.official ?? lookupOfficialPlate)(plate),
 ]);
 return formatPlateLookup(internal.error ? null : internal.data, registry, input.locale);
}
