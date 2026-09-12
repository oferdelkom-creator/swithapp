import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SwitchApp France — Acheter, vendre ou échanger une voiture",
  description: "La plateforme automobile qui rapproche particuliers et professionnels grâce à une découverte simple, des matchs et une messagerie directe.",
};

export default function FranceLandingPage() {
  return <div id="switchapp-france" lang="fr" dir="ltr" className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-950 text-white">
    <style>{`
      body:has(#switchapp-france) > header,
      body:has(#switchapp-france) > main + div { display: none !important; }
      body:has(#switchapp-france) > main { padding: 0 !important; }
    `}</style>
    <nav className="border-b border-white/10 bg-blue-950/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <strong className="text-xl tracking-tight">SwitchApp <span className="text-orange-400">France</span></strong>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold">FR</span>
      </div>
    </nav>
    <section className="mx-auto grid min-h-[72vh] max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-20">
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Pré-lancement en France</p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">Achetez.<br />Vendez.<br /><span className="text-orange-400">Échangez autrement.</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-blue-100">Découvrez des véhicules par glissement, créez des matchs avec des propriétaires et échangez directement. Une version entièrement adaptée au marché français est en préparation.</p>
        <div className="mt-9"><span className="inline-flex rounded-full bg-orange-500 px-6 py-3 font-bold">Ouverture prochaine</span></div>
      </div>
      <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-7">
        <p className="text-sm font-bold text-blue-200">POUR LES PARTICULIERS ET LES PROFESSIONNELS</p>
        <div className="mt-6 space-y-4">
          {[
            ["Découverte rapide","Parcourez les véhicules selon vos critères."],
            ["Vente ou échange","Proposez une vente, un échange ou une différence de prix."],
            ["Contact direct","Discutez quand l’intérêt est réciproque."],
            ["Vitrines professionnelles","Pages dédiées aux concessions et marchands."]
          ].map(([title,text])=><article key={title} className="rounded-2xl bg-white p-5 text-slate-950"><h2 className="font-black">{title}</h2><p className="mt-1 text-sm text-slate-600">{text}</p></article>)}
        </div>
      </div>
    </section>
    <section className="border-t border-white/10 bg-white/5"><div className="mx-auto max-w-6xl px-6 py-14 md:py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">Déploiement France</p><h2 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">Données automobiles françaises, règles locales, paiements en euros et premiers partenaires.</h2><p className="mt-6 text-blue-100">La préparation est en cours. Aucun paiement n’est collecté sur cette page.</p></div></section>
    <footer className="border-t border-white/10 bg-slate-950"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8"><strong>SwitchApp France</strong><span className="text-sm text-slate-400">Plateforme automobile européenne · Pré-lancement</span></div></footer>
  </div>;
}
