import type { Metadata } from "next";
import Link from "next/link";
import { EUROPE_PARTICIPANTS } from "@/lib/markets";

export const metadata: Metadata = {
  title: "SwitchApp Europe — La plateforme automobile réunie",
  description: "Particuliers, marchands, concessions, importateurs officiels et parallèles sur une même plateforme automobile européenne.",
};

export default function EuropeLandingPage() {
  return <div id="switchapp-france" lang="fr" dir="ltr" className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-950 text-white">
    <style>{`
      body:has(#switchapp-france) > header,
      body:has(#switchapp-france) > main + div { display: none !important; }
      body:has(#switchapp-france) > main { padding: 0 !important; }
    `}</style>
    <nav className="border-b border-white/10 bg-blue-950/95"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"><strong className="text-xl tracking-tight">SwitchApp <span className="text-orange-400">Europe</span></strong><span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold">FR · France en premier</span></div></nav>
    <section className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-20">
      <div><p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Une plateforme européenne · Lancement en France</p><h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">Achetez.<br />Vendez.<br /><span className="text-orange-400">Échangez autrement.</span></h1><p className="mt-7 max-w-xl text-lg leading-8 text-blue-100">Tous les acteurs automobiles sur une même plateforme : particuliers, marchands, concessions et importateurs. La France est notre premier marché européen.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/europe/vehicle-history" className="inline-flex min-h-12 items-center rounded-full bg-orange-500 px-6 py-3 font-bold transition hover:bg-orange-600">Vérifier un véhicule</Link><span className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-5 py-3 text-sm font-bold">France · Ouverture prochaine</span></div></div>
      <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur"><p className="text-sm font-bold text-blue-200">UNE SEULE PLACE POUR TOUT LE MARCHÉ</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{EUROPE_PARTICIPANTS.slice(0, 4).map((participant)=><article key={participant.kind} className="rounded-2xl bg-white p-4 text-slate-950"><h2 className="font-black">{participant.titleFr}</h2><p className="mt-1 text-sm text-slate-600">{participant.descriptionFr}</p></article>)}</div></div>
    </section>
    <section className="border-t border-white/10 bg-white/5"><div className="mx-auto max-w-6xl px-6 py-14"><p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">Partenaires automobiles</p><h2 className="mt-3 max-w-4xl text-3xl font-black md:text-5xl">Tous les professionnels peuvent rejoindre le même réseau.</h2><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{EUROPE_PARTICIPANTS.map((participant)=><article key={participant.kind} className="rounded-2xl border border-white/10 bg-white/10 p-5"><h3 className="font-black">{participant.titleFr}</h3><p className="mt-2 text-sm text-blue-100">{participant.descriptionFr}</p></article>)}</div></div></section>
    <section className="border-t border-white/10"><div className="mx-auto max-w-6xl px-6 py-14"><p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">Fondation européenne</p><div className="mt-6 grid gap-4 md:grid-cols-4">{[["Marché","France, puis Europe"],["Devise","Euro"],["Langue initiale","Français"],["Architecture","Pays, devise et données séparés"]].map(([label,value])=><div key={label} className="rounded-2xl bg-white p-5 text-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 font-black">{value}</p></div>)}</div><div className="mt-7 flex flex-wrap items-center gap-4"><p className="max-w-3xl text-blue-100">Les données automobiles françaises, les règles locales, les paiements en euros et l’intégration des premiers partenaires sont en préparation. Aucun paiement n’est collecté sur cette page.</p><Link href="/europe/vehicle-history" className="font-black text-orange-300 hover:text-orange-200">Découvrir la vérification automobile →</Link></div></div></section>
    <footer className="border-t border-white/10 bg-slate-950"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8"><strong>SwitchApp Europe</strong><span className="text-sm text-slate-400">France · Premier marché</span></div></footer>
  </div>;
}
