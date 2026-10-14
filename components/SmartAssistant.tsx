"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import type { AssistantCar, ChatMessage } from "@/lib/assistant";

const copy = {
  he: { title: "העוזר של SwitchApp", open: "עוזר חכם", close: "סגירה", customer: "מציאת רכב", business: "עוזר לעסק", welcome: "ספרו לי איזה רכב אתם מחפשים, ואעזור למצוא ולהשוות מתוך המלאי הקיים.", supplierWelcome: "אפשר לבקש סיכום מלאי ופניות, או להכין נוסח למודעת רכב.", placeholder: "במה אפשר לעזור?", send: "שליחה", thinking: "בודק את הנתונים…", privacy: "השיחה ונתוני הרכב הנחוצים מועברים ל־OpenAI לצורך התשובה. הימנעו מהזנת פרטים רגישים.", login: "התחברו כדי לשוחח עם העוזר", error: "העוזר אינו זמין כרגע. נסו שוב בעוד רגע.", limit: "הגעתם למכסת השיחות לשעה זו. נסו שוב מאוחר יותר.", examples: ["רכב משפחתי עד 100,000 ₪", "עזור לי להשוות רכבים חשמליים"], supplierExamples: ["סכם את המלאי והפניות שלי", "הכן נוסח למודעה מתוך המלאי שלי"], reset: "שיחה חדשה", view: "לפרטי הרכב" },
  en: { title: "SwitchApp assistant", open: "Smart assistant", close: "Close", customer: "Find a vehicle", business: "Business assistant", welcome: "Tell me what vehicle you need. I can find and compare current listings.", supplierWelcome: "Ask for an inventory and leads summary, or help drafting an ad.", placeholder: "How can I help?", send: "Send", thinking: "Checking the data…", privacy: "Messages and relevant vehicle data are sent to OpenAI to answer. Avoid sensitive information.", login: "Sign in to chat with the assistant", error: "The assistant is unavailable. Please try again shortly.", limit: "You reached this hour's conversation limit. Try again later.", examples: ["A family car under ₪100,000", "Help compare electric vehicles"], supplierExamples: ["Summarize my inventory and leads", "Draft an ad for a vehicle in my inventory"], reset: "New chat", view: "View vehicle" },
  ru: { title: "Помощник SwitchApp", open: "Умный помощник", close: "Закрыть", customer: "Найти автомобиль", business: "Для бизнеса", welcome: "Расскажите, какой автомобиль вам нужен. Помогу найти и сравнить текущие объявления.", supplierWelcome: "Могу подвести итоги по автомобилям и обращениям или подготовить объявление.", placeholder: "Чем помочь?", send: "Отправить", thinking: "Проверяю данные…", privacy: "Сообщения и необходимые данные автомобилей передаются OpenAI для ответа. Не вводите конфиденциальные данные.", login: "Войдите, чтобы общаться с помощником", error: "Помощник временно недоступен. Повторите позже.", limit: "Достигнут лимит запросов за час. Повторите позже.", examples: ["Семейный автомобиль до ₪100,000", "Помоги сравнить электромобили"], supplierExamples: ["Сводка моих автомобилей и обращений", "Подготовь объявление для моего автомобиля"], reset: "Новый чат", view: "Подробнее" },
  ar: { title: "مساعد SwitchApp", open: "المساعد الذكي", close: "إغلاق", customer: "البحث عن سيارة", business: "مساعد الأعمال", welcome: "أخبرني عن السيارة المطلوبة لأساعدك في العثور عليها ومقارنتها من المخزون الحالي.", supplierWelcome: "اطلب ملخص المخزون والاستفسارات أو مسودة إعلان سيارة.", placeholder: "كيف أساعدك؟", send: "إرسال", thinking: "جارٍ التحقق…", privacy: "تُرسل المحادثة وبيانات السيارات اللازمة إلى OpenAI للإجابة. تجنب المعلومات الحساسة.", login: "سجل الدخول للتحدث مع المساعد", error: "المساعد غير متاح حالياً. حاول لاحقاً.", limit: "وصلت إلى حد المحادثات لهذه الساعة. حاول لاحقاً.", examples: ["سيارة عائلية حتى ₪100,000", "ساعدني بمقارنة السيارات الكهربائية"], supplierExamples: ["لخص المخزون والاستفسارات الخاصة بي", "جهز مسودة إعلان لسيارة من مخزوني"], reset: "محادثة جديدة", view: "تفاصيل السيارة" },
};

export default function SmartAssistant({ loggedIn, isBusiness }: { loggedIn: boolean; isBusiness: boolean }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"customer" | "business">("customer");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cars, setCars] = useState<AssistantCar[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => () => controller.current?.abort(), []);

  function reset(nextMode = mode) { setMode(nextMode); setMessages([]); setCars([]); setError(""); setDraft(""); }
  async function send(content = draft) {
    if (busy || !loggedIn || !content.trim()) return;
    const prior = messages.slice(-10);
    const userMessage: ChatMessage = { role: "user", content: content.trim().slice(0, 2000) };
    setMessages([...prior, userMessage]); setDraft(""); setError(""); setBusy(true);
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...prior, userMessage], mode, locale }), signal: controller.current.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (typeof result.text !== "string") throw new Error("invalid_response");
      setMessages([...prior, userMessage, { role: "assistant", content: result.text }]);
      setCars(Array.isArray(result.cars) ? result.cars : []);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const code = cause instanceof Error ? cause.message : "";
      setError(code === "hourly_limit" || code === "ai_limit" ? c.limit : code === "login_required" ? c.login : c.error);
      setMessages(prior); setDraft(userMessage.content);
    } finally { setBusy(false); }
  }

  if (pathname === "/") return null;
  return <aside dir={locale === "he" || locale === "ar" ? "rtl" : "ltr"}>
    <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="switchapp-assistant" className="fixed bottom-24 end-4 z-40 rounded-full bg-slate-950 px-5 py-3 font-bold text-white shadow-xl md:bottom-6">✦ {c.open}</button>
    {open && <section id="switchapp-assistant" aria-label={c.title} className="fixed bottom-40 end-3 z-50 flex max-h-[75dvh] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-2xl md:bottom-24">
      <header className="flex items-center justify-between gap-2 bg-slate-950 p-4 text-white"><h2 className="font-bold">✦ {c.title}</h2><button onClick={() => setOpen(false)} aria-label={c.close} className="rounded-lg px-3 py-1 text-xl">×</button></header>
      {isBusiness && <div className="flex gap-2 border-b p-3">{(["customer", "business"] as const).map((value) => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => reset(value)} className={`flex-1 rounded-full px-3 py-2 text-sm ${mode === value ? "bg-blue-700 text-white" : "bg-slate-100"}`}>{value === "business" ? c.business : c.customer}</button>)}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!messages.length && <><p className="leading-7">{mode === "business" ? c.supplierWelcome : c.welcome}</p>{loggedIn && <div className="mt-4 space-y-2">{(mode === "business" ? c.supplierExamples : c.examples).map((example) => <button key={example} onClick={() => void send(example)} disabled={busy} className="block w-full rounded-2xl border border-slate-200 p-3 text-start text-sm hover:bg-blue-50">{example}</button>)}</div>}</>}
        <div role="log" aria-live="polite" className="space-y-3">{messages.map((message, index) => <p key={index} className={`whitespace-pre-wrap rounded-2xl p-3 text-sm leading-7 ${message.role === "user" ? "ms-6 bg-blue-700 text-white" : "me-6 bg-slate-100"}`}>{message.content}</p>)}</div>
        {cars.length > 0 && <div className="mt-4 space-y-2">{cars.map((car) => <Link key={car.id} href={`/cars/${encodeURIComponent(car.id)}`} className="block rounded-2xl border p-3 text-sm"><strong>{car.make} {car.model} {car.year ?? ""}</strong><span className="block">{car.price !== null ? `${new Intl.NumberFormat(locale).format(car.price)} ₪` : ""} · {c.view}</span></Link>)}</div>}
        {busy && <p role="status" className="mt-4 text-sm text-slate-500">{c.thinking}</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{error}</p>}
        <div ref={bottom} />
      </div>
      <footer className="border-t p-3">
        {loggedIn ? <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex gap-2"><textarea ref={input} aria-label={c.placeholder} placeholder={c.placeholder} maxLength={2000} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} className="min-w-0 flex-1 resize-none rounded-xl border p-2 text-sm" /><button disabled={busy || !draft.trim()} className="rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40">{c.send}</button></form> : <Link href="/login" className="block rounded-full bg-blue-700 p-3 text-center font-bold text-white">{c.login}</Link>}
        <p className="mt-2 text-[11px] leading-5 text-slate-500">{c.privacy}</p>
        {!!messages.length && <button disabled={busy} onClick={() => reset()} className="mt-1 text-xs text-blue-700 underline">{c.reset}</button>}
      </footer>
    </section>}
  </aside>;
}
