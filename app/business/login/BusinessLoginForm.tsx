"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

export default function BusinessLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setError(t("partnerLogin.invalidCredentials"));
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, is_admin")
      .eq("id", data.user.id)
      .maybeSingle<{ role: string; is_admin: boolean }>();

    if (!profile || (!profile.is_admin && profile.role !== "dealer" && profile.role !== "importer")) {
      await supabase.auth.signOut();
      setError(t("partnerLogin.notBusinessAccount"));
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    router.push(next?.startsWith("/business") ? next : "/business");
    router.refresh();
  }

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[#07111f] px-4 py-12 text-white sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section>
          <p className="text-sm font-semibold tracking-[0.18em] text-cyan-300">SWITCHAUTO AI</p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t("partnerLogin.title")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            {t("partnerLogin.subtitle")}
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center text-xs text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{t("partnerLogin.inventory")}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{t("partnerLogin.leads")}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{t("partnerLogin.showroom")}</div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white p-6 text-neutral-900 shadow-2xl shadow-cyan-950/30 sm:p-8">
          <h2 className="text-2xl font-semibold">{t("partnerLogin.formTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-500">{t("partnerLogin.formSubtitle")}</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.email")}</label>
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.password")}</label>
              <input required type="password" autoComplete="current-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50">
              {loading ? t("businessJoin.wait") : t("partnerLogin.signIn")}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-500">
            {t("partnerLogin.noAccount")}{" "}
            <Link href="/business/join/signup" className="font-medium text-blue-700">
              {t("partnerLogin.createAccount")}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

