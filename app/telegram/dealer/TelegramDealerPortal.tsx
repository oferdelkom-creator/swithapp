"use client";

import Script from "next/script";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "inventory" | "leads" | "profile";
type Availability = "in_stock" | "in_transit" | "on_order" | "reserved" | "sold";
type Account = { role: "dealer" | "importer"; business_name: string; city: string; phone: string; tax_id?: string | null; trial_ends_at: string; verified: boolean };
type InventoryItem = { id: string; make: string; model: string; year: number; price: number; status: string; source_payload: { availability?: Availability; mileage?: number; city?: string; vin?: string } };
type Lead = { id: string; lead_type: "sale" | "swap"; buyer_name?: string; buyer_phone?: string; status: string; created_at: string; buyer_car?: Record<string, unknown> };

const labels: Record<Availability, string> = { in_stock: "В наличии", in_transit: "В пути", on_order: "Под заказ", reserved: "Резерв", sold: "Продан" };

function parseCsv(source: string) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export default function TelegramDealerPortal() {
  const router = useRouter();
  const [initData, setInitData] = useState("");
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<Tab>("inventory");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [registration, setRegistration] = useState({ role: "dealer", business_name: "", city: "Москва", phone: "", tax_id: "" });
  const [car, setCar] = useState({ make: "", model: "", year: String(new Date().getFullYear()), price: "", mileage: "", city: "Москва", availability: "in_stock", vin: "", country_of_origin: "", eta: "", shipping_cost: "", customs_cost: "" });

  const load = useCallback(async (session: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/telegram/dealer?initData=${encodeURIComponent(session)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json() as { account: Account | null; inventory: InventoryItem[]; leads: Lead[] };
      setAccount(data.account); setInventory(data.inventory); setLeads(data.leads);
    } catch { setMessage("Не удалось загрузить кабинет. Откройте его внутри Telegram."); }
    finally { setLoading(false); }
  }, []);

  const setupTelegram = () => {
    const app = window.Telegram?.WebApp;
    if (!app) { setLoading(false); return; }
    app.ready(); app.expand(); app.setHeaderColor?.("#070b18"); app.setBackgroundColor?.("#070b18");
    setInitData(app.initData);
    void load(app.initData);
  };

  const api = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/telegram/dealer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData, ...payload }) });
    const data = await response.json().catch(() => null) as { error?: string; imported?: number; rejected?: number } | null;
    if (!response.ok) throw new Error(data?.error ?? "request_failed");
    return data;
  };

  const register = async () => {
    setBusy(true); setMessage(null);
    try { await api({ action: "register", account: registration }); await load(initData); }
    catch { setMessage("Проверьте название, город и телефон."); }
    finally { setBusy(false); }
  };

  const saveCar = async () => {
    setBusy(true); setMessage(null);
    try { await api({ action: "upsert_listing", listing: car }); setShowForm(false); setCar({ ...car, make: "", model: "", price: "", mileage: "", vin: "" }); await load(initData); setMessage("Автомобиль опубликован ✓"); }
    catch { setMessage("Не удалось сохранить автомобиль. Проверьте обязательные поля."); }
    finally { setBusy(false); }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setMessage(null);
    try {
      const rows = parseCsv(await file.text()).map((row) => ({ ...row, city: row.city || account?.city || "Москва", availability: row.status || row.availability || "in_stock", photo_urls: row.photo_urls ? String(row.photo_urls).split("|") : [] }));
      const result = await api({ action: "import_csv", listings: rows });
      await load(initData); setMessage(`Импортировано: ${result?.imported ?? 0}. Отклонено: ${result?.rejected ?? 0}.`);
    } catch { setMessage("Импорт не выполнен. Используйте CSV с колонками make, model, year, price, city."); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, availability: Availability) => {
    setBusy(true);
    try { await api({ action: "set_status", listingId: id, availability }); await load(initData); }
    catch { setMessage("Не удалось изменить статус."); }
    finally { setBusy(false); }
  };

  const activeCount = inventory.filter((item) => item.status === "active").length;
  const trialDays = useMemo(() => account ? Math.max(0, Math.ceil((new Date(account.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0, [account]);

  return <>
    <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="afterInteractive" onLoad={setupTelegram} />
    <main className="telegram-app min-h-[100dvh] bg-[#070b18] text-white" lang="ru">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div><div className="text-lg font-black">SWITCH<span className="text-[#ff4f70]">APP</span> <span className="text-xs text-white/40">BUSINESS</span></div><div className="text-[11px] text-white/45">Дилеры и импортёры · Россия</div></div>
          <button onClick={() => router.push("/telegram?market=RU")} className="rounded-full border border-white/10 px-3 py-2 text-[11px] font-bold">Для покупателей</button>
        </header>

        {loading ? <div className="flex flex-1 items-center justify-center text-sm text-white/45">Загружаем кабинет…</div> : !account ? (
          <section className="py-8">
            <div className="inline-flex rounded-full bg-[#ff4f70]/15 px-3 py-1.5 text-xs font-bold text-[#ff91a6]">30 ДНЕЙ БЕСПЛАТНО</div>
            <h1 className="mt-5 text-4xl font-black leading-tight">Продажи и обмены прямо в Telegram</h1>
            <p className="mt-3 text-sm leading-6 text-white/55">Загрузите автомобили, получайте заявки на покупку и trade-in, управляйте статусами в одном кабинете.</p>
            <div className="mt-7 grid grid-cols-2 gap-2">
              {([ ["dealer", "Автосалон"], ["importer", "Импортёр"] ] as const).map(([value, label]) => <button key={value} onClick={() => setRegistration({ ...registration, role: value })} className={`rounded-2xl border p-4 text-sm font-bold ${registration.role === value ? "border-[#ff4f70] bg-[#ff4f70]/15" : "border-white/10 bg-white/5"}`}>{label}</button>)}
            </div>
            <div className="mt-5 space-y-3">
              <input value={registration.business_name} onChange={(e) => setRegistration({ ...registration, business_name: e.target.value })} placeholder="Название компании *" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
              <input value={registration.city} onChange={(e) => setRegistration({ ...registration, city: e.target.value })} placeholder="Город *" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
              <input value={registration.phone} onChange={(e) => setRegistration({ ...registration, phone: e.target.value })} placeholder="Телефон *" inputMode="tel" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
              <input value={registration.tax_id} onChange={(e) => setRegistration({ ...registration, tax_id: e.target.value })} placeholder="ИНН (необязательно)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
            </div>
            <button onClick={() => void register()} disabled={busy || !initData || !registration.business_name || !registration.phone} className="mt-6 w-full rounded-2xl bg-[#ff4f70] px-5 py-4 font-black disabled:opacity-40">{busy ? "Создаём кабинет…" : "Начать бесплатный пилот"}</button>
            {!initData ? <p className="mt-3 text-center text-xs text-amber-200/70">Регистрация доступна при открытии через Telegram.</p> : null}
            {message ? <p className="mt-3 rounded-xl bg-red-300/10 p-3 text-xs text-red-100">{message}</p> : null}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2 py-4">
              <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl font-black">{activeCount}</div><div className="text-[10px] text-white/45">Активных авто</div></div>
              <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl font-black">{leads.filter((lead) => lead.status === "new").length}</div><div className="text-[10px] text-white/45">Новых заявок</div></div>
              <div className="rounded-2xl bg-[#ff4f70]/10 p-3"><div className="text-2xl font-black text-[#ff91a6]">{trialDays}</div><div className="text-[10px] text-white/45">Дней пилота</div></div>
            </section>

            <div className="mb-4 grid grid-cols-3 rounded-2xl bg-white/5 p-1">
              {([ ["inventory", `Авто ${inventory.length}`], ["leads", `Заявки ${leads.length}`], ["profile", "Профиль"] ] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`rounded-xl px-2 py-2 text-xs font-bold ${tab === value ? "bg-white text-[#070b18]" : "text-white/55"}`}>{label}</button>)}
            </div>

            {tab === "inventory" ? <section className="min-h-0 flex-1 overflow-y-auto pb-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowForm(!showForm)} className="rounded-2xl bg-[#ff4f70] px-3 py-3 text-sm font-black">+ Добавить авто</button>
                <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold">{busy ? "Импорт…" : "Импорт CSV"}<input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
              </div>
              {showForm ? <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <h2 className="font-black">Новый автомобиль</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {([ ["make", "Марка *"], ["model", "Модель *"], ["year", "Год *"], ["price", "Цена, ₽ *"], ["mileage", "Пробег, км"], ["city", "Город *"], ["vin", "VIN"], ["country_of_origin", "Страна отправки"], ["eta", "Срок поставки"], ["shipping_cost", "Доставка, ₽"], ["customs_cost", "Таможня, ₽"] ] as const).map(([key, placeholder]) => <input key={key} value={car[key]} onChange={(e) => setCar({ ...car, [key]: e.target.value })} placeholder={placeholder} className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none" />)}
                </div>
                <select value={car.availability} onChange={(e) => setCar({ ...car, availability: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d1324] px-3 py-3 text-sm">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <button onClick={() => void saveCar()} disabled={busy || !car.make || !car.model || !car.price} className="mt-3 w-full rounded-xl bg-white px-4 py-3 font-black text-[#070b18] disabled:opacity-40">Опубликовать</button>
              </div> : null}
              <div className="mt-4 space-y-3">{inventory.length ? inventory.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex justify-between gap-3"><div><h3 className="font-black">{item.make} {item.model} · {item.year}</h3><p className="mt-1 text-sm text-white/55">{new Intl.NumberFormat("ru-RU").format(item.price)} ₽ · {item.source_payload.mileage ? `${new Intl.NumberFormat("ru-RU").format(item.source_payload.mileage)} км` : "Пробег не указан"}</p></div><span className="h-fit rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-bold text-emerald-200">{labels[item.source_payload.availability ?? "in_stock"]}</span></div>
                <select disabled={busy} value={item.source_payload.availability ?? "in_stock"} onChange={(e) => void setStatus(item.id, e.target.value as Availability)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#0d1324] px-3 py-2 text-xs">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </article>) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">Добавьте первый автомобиль вручную или загрузите CSV.</div>}</div>
            </section> : null}

            {tab === "leads" ? <section className="space-y-3">{leads.length ? leads.map((lead) => <article key={lead.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex justify-between"><strong>{lead.lead_type === "swap" ? "Trade-in / обмен" : "Покупка"}</strong><span className="text-xs text-[#ff91a6]">{lead.status}</span></div><p className="mt-2 text-sm text-white/60">{lead.buyer_name || "Клиент из Telegram"}{lead.buyer_phone ? ` · ${lead.buyer_phone}` : ""}</p></article>) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45"><div className="text-3xl">◎</div><div className="mt-3 font-bold text-white/70">Заявок пока нет</div><div className="mt-2">Они появятся здесь, когда покупатель выберет ваш автомобиль.</div></div>}</section> : null}

            {tab === "profile" ? <section className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="text-xs font-bold uppercase tracking-widest text-[#ff91a6]">{account.role === "importer" ? "Импортёр" : "Автосалон"}</div><h2 className="mt-2 text-2xl font-black">{account.business_name}</h2><p className="mt-2 text-sm text-white/55">{account.city} · {account.phone}</p><div className="mt-5 rounded-2xl bg-[#ff4f70]/10 p-4"><strong>Пилот: ещё {trialDays} дней</strong><p className="mt-1 text-xs leading-5 text-white/50">После пилота Dealer Pro можно продлить за Telegram Stars. Автопродления нет.</p></div></section> : null}
            {message ? <p className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-white/70">{message}</p> : null}
          </>
        )}
      </div>
    </main>
  </>;
}


