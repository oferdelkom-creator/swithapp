import type {ChatMessage} from './assistant';
export function validateEmail(value:unknown){
 if(typeof value!=='string')throw Error('invalid_email');
 const email=value.trim().toLowerCase();
 if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||/[<>\r\n\x00-\x1f]/.test(email))throw Error('invalid_email');
 return email;
}
export type ReportContact={contact_name:string;phone_e164:string;email:string|null;offers_consent_at:string|null};
export type ReportConversation={id:string;intent:string;messages:ChatMessage[];search_filters:Record<string,unknown>|null;no_match:boolean;created_at:string;ended_at:string|null};
const intents:Record<string,string>={buy:'קניית רכב',sell:'מכירת רכב',swap:'החלפת רכב',business:'שירות לעסק'};
export function searchDescription(filters:Record<string,unknown>|null){
 if(!filters)return 'ראו את השיחה';
 const items:string[]=[];
 if(filters.make)items.push(`יצרן: ${filters.make}`);
 if(filters.model)items.push(`דגם: ${filters.model}`);
 if(typeof filters.min_price==='number')items.push(`תקציב מינימלי: ${filters.min_price.toLocaleString('he-IL')} ₪`);
 if(typeof filters.max_price==='number')items.push(`תקציב מרבי: ${filters.max_price.toLocaleString('he-IL')} ₪`);
 if(typeof filters.min_year==='number')items.push(`משנתון: ${filters.min_year}`);
 if(filters.electric_only===true)items.push('רכב חשמלי בלבד');
 return items.join(' · ')||'לא הוגדרו מגבלות חיפוש; ראו את השיחה';
}
export function reportText(contact:ReportContact,conversation:ReportConversation){
 return ['SwitchApp — דוח סיום שיחה',`שם: ${contact.contact_name}`,`טלפון (לא אומת): ${contact.phone_e164}`,`מייל: ${contact.email??'לא נמסר'}`,`מטרת הביקור: ${intents[conversation.intent]??conversation.intent}`,`תוצאת החיפוש: ${conversation.no_match?'לא נמצא רכב מתאים — נדרש המשך טיפול':'ראו את השיחה; ההתאמה טעונה אישור הלקוח'}`,`בקשה להצעות במייל: ${contact.offers_consent_at?'הלקוח אישר קבלת הצעות רלוונטיות':'לא ניתנה הסכמה'}`,`דרישות החיפוש: ${searchDescription(conversation.search_filters)}`,`תאריך: ${new Date(conversation.created_at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})}`,'','תמליל השיחה:',...conversation.messages.map((m,i)=>`${i+1}. ${m.role==='user'?'לקוח':'עוזר'}: ${i===0&&m.role==='user'?intents[conversation.intent]??m.content:m.content}`)].join('\n');
}
export async function sendConversationReport(contact:ReportContact,conversation:ReportConversation,fetcher:typeof fetch=fetch){
 const key=process.env.RESEND_API_KEY;
 if(!key)throw Error('mail_not_configured');
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`visitor-report-${conversation.id}`},body:JSON.stringify({from:process.env.ASSISTANT_REPORT_FROM??'SwitchApp <notifications@fixfix.me>',to:[process.env.ASSISTANT_REPORT_TO??'ofer.delkom@gmail.com'],subject:'SwitchApp — דוח סיום שיחה',text:reportText(contact,conversation)})});
 if(!response.ok)throw Error('mail_unavailable');
}
