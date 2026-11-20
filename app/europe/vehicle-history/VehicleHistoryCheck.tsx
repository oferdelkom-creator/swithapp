"use client";

import { FormEvent, useMemo, useState } from "react";

type SearchMode = "plate" | "vin";
type ViewState = "idle" | "ready";

const packages = [
  { reports: 6, price: 89, label: "Essentiel", unit: "14,83 €" },
  { reports: 12, price: 149, label: "Professionnel", unit: "12,42 €", featured: true },
  { reports: 24, price: 249, label: "Volume", unit: "10,38 €" },
];

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
}

function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
}

export default function VehicleHistoryCheck() {
  const [mode, setMode] = useState<SearchMode>("plate");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ViewState>("idle");
  const [error, setError] = useState("");

  const formatted = useMemo(() => {
    if (mode === "vin") return normalizeVin(query);
    const raw = normalizePlate(query);
    if (raw.length <= 2) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
    return `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5, 7)}`;
  }, [mode, query]);

  function changeMode(next: SearchMode) {
    setMode(next);
    setQuery("");
    setError("");
    setState("idle");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = mode === "vin" ? normalizeVin(query) : normalizePlate(query);
    const valid = mode === "vin" ? clean.length === 17 : /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(clean);
    if (!valid) {
      setError(mode === "vin" ? "Saisissez les 17 caractères du VIN." : "Saisissez une immatriculation française au format AA-123-AA.");
      setState("idle");
      return;
    }
    setError("");
    setState("ready");
  }

  return (
    <main id="switchapp-history" lang="fr" className="min-h-screen bg-[#07152e] text-white">
      <style>{`
        body:has(#switchapp-history) > header,
        body:has(#switchapp-history) > main + div { display: none !important; }
        body:has(#switchapp-history) > main { padding: 0 !important; }
      `}</style>

      <nav className="border-b border-white/10 bg-[#07152e]/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="/europe" className="text-xl font-black tracking-tight">SwitchApp <span className="text-orange-400">Europe</span></a>
          <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-blue-100">France · Bêta</span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div className="pt-2">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">Historique du véhicule</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">Vérifiez avant d’acheter, vendre ou échanger.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-blue-100">Identifiez le véhicule et préparez un contrôle de son kilométrage, ses dommages connus, ses changements de pays et son statut administratif.</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                ["01", "Identification", "Plaque française ou numéro VIN"],
                ["02", "Sources croisées", "France et historique international"],
                ["03", "Rapport partageable", "Synthèse claire pour l’annonce"],
                ["04", "Traçabilité", "Source et date de chaque contrôle"],
              ].map(([number, title, copy]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <span className="text-xs font-black text-orange-300">{number}</span>
                  <h2 className="mt-2 font-black">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-blue-100">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-white p-5 text-slate-950 shadow-2xl sm:p-7">
            <div className="flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Mode de recherche">
              <button type="button" onClick={() => changeMode("plate")} className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-black transition ${mode === "plate" ? "bg-white shadow-sm text-blue-950" : "text-slate-500"}`}>Immatriculation</button>
              <button type="button" onClick={() => changeMode("vin")} className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-black transition ${mode === "vin" ? "bg-white shadow-sm text-blue-950" : "text-slate-500"}`}>Numéro VIN</button>
            </div>

            <form onSubmit={submit} className="mt-6">
              <label htmlFor="vehicle-query" className="text-sm font-bold text-slate-700">
                {mode === "plate" ? "Plaque d’immatriculation française" : "Numéro de châssis (VIN)"}
              </label>
              <input
                id="vehicle-query"
                value={formatted}
                onChange={(event) => setQuery(event.target.value)}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={mode === "plate" ? "AB-123-CD" : "VF1XXXXXXXXXXXXXX"}
                className="mt-2 h-16 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-xl font-black uppercase tracking-[0.12em] outline-none transition focus:border-blue-700"
                aria-describedby={error ? "vehicle-error" : "vehicle-help"}
              />
              {error ? <p id="vehicle-error" className="mt-2 text-sm font-semibold text-red-600">{error}</p> : <p id="vehicle-help" className="mt-2 text-sm text-slate-500">Nous ne lançons aucun rapport payant sans votre confirmation.</p>}
              <button className="mt-5 min-h-14 w-full rounded-xl bg-orange-500 px-5 font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200">
                Préparer la vérification
              </button>
            </form>

            {state === "ready" && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-live="polite">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-700 text-sm font-black text-white">✓</span>
                  <div>
                    <p className="font-black text-blue-950">Format vérifié : {formatted}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Le connecteur est prêt. Le rapport réel sera activé après signature avec notre fournisseur de données européen.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-sm font-black text-slate-800">Vous êtes le propriétaire ?</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Générez gratuitement le rapport administratif officiel HistoVec puis ajoutez son lien à votre annonce SwitchApp.</p>
              <a href="https://histovec.interieur.gouv.fr/" target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-4 text-sm font-black text-blue-800 hover:bg-blue-50">Ouvrir HistoVec ↗</a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.04]">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">Packs professionnels</p>
            <h2 className="mt-3 text-3xl font-black">Des contrôles adaptés à votre stock</h2>
            <p className="mt-3 leading-7 text-blue-100">Tarifs de lancement proposés, hors taxes. Aucun débit avant l’activation du fournisseur.</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {packages.map((item) => (
              <article key={item.reports} className={`relative rounded-2xl border p-6 ${item.featured ? "border-orange-400 bg-white text-slate-950 shadow-xl" : "border-white/15 bg-white/[0.07]"}`}>
                {item.featured && <span className="absolute -top-3 right-5 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">Le plus choisi</span>}
                <p className={`text-sm font-bold ${item.featured ? "text-blue-700" : "text-blue-200"}`}>{item.label}</p>
                <p className="mt-3 text-4xl font-black">{item.reports} <span className="text-base font-bold">rapports</span></p>
                <p className="mt-5 text-3xl font-black">{item.price} € <span className="text-sm font-medium opacity-60">HT</span></p>
                <p className="mt-1 text-sm opacity-65">{item.unit} HT par rapport</p>
                <button type="button" disabled className={`mt-6 min-h-12 w-full cursor-not-allowed rounded-xl px-4 font-black opacity-75 ${item.featured ? "bg-blue-950 text-white" : "bg-white text-blue-950"}`}>Disponible prochainement</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-12 md:grid-cols-3">
          {[
            ["Données françaises", "Identification technique et rapport administratif partagé par le propriétaire."],
            ["Historique européen", "Dommages, kilométrage, vol et import selon les données disponibles pour chaque VIN."],
            ["Résultat responsable", "L’absence de donnée ne sera jamais présentée comme la preuve d’un véhicule sans accident."],
          ].map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 p-5"><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-blue-100">{copy}</p></div>)}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-7">
          <strong>SwitchApp Europe</strong>
          <span className="text-sm text-slate-400">Vérification automobile · France</span>
        </div>
      </footer>
    </main>
  );
}
