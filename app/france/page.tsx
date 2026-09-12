import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SwitchApp France — Acheter, vendre ou échanger une voiture",
  description: "La plateforme automobile qui rapproche particuliers et professionnels grâce à une découverte simple, des matchs et une messagerie directe.",
};

export default function FranceLandingPage() {
  return <div lang="fr" dir="ltr" className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-950 text-white">
    <section className="mx-auto grid min-h-[72vh] max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-blue-200">SwitchApp France · Pré-lancement</p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">Achetez. Vendez.<br /><span className="text-orange-400">Échangez autrement.</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-blue-100">Découvrez des véhicules par glissement, créez des matchs avec des propriétaires et échangez directement. Une version adaptée au marché français est en préparation.</p>
        <div className="mt-9 flex flex-wrap gap-3"><span className="rounded-full bg-orange-500 px-6 py-3 font-bold">Ouverture prochaine</span><Link className="rounded-full border border-white/30 px-6 py-3 font-bold hover:bg-white/10" href="/">Voir la plateforme actuelle</Link></div>
      </div>
      <div className="rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur">
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
    <section className="border-t border-white/10 bg-white/5"><div className="mx-auto max-w-6xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">Déploiement France</p><h2 className="mt-3 max-w-3xl text-3xl font-black md:text-5xl">Nous préparons les données véhicule, les règles locales, les paiements en euros et les premiers partenaires automobiles.</h2><p className="mt-6 text-blue-100">Cette page ne collecte aucun paiement et ne promet pas encore de date de lancement.</p></div></section>
  </div>;
}
