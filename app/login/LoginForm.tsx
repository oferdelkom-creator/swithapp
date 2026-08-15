"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        // name goes in user metadata; a DB trigger creates the public.users
        // row from it the moment the auth user is created, so it exists even
        // if email confirmation delays the session.
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setError(t("login.confirmEmail"));
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : t("login.genericError");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex gap-2 mb-6 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={mode === "signin" ? "btn-primary" : "btn-secondary"}
        >
          {t("login.signIn")}
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={mode === "signup" ? "btn-primary" : "btn-secondary"}
        >
          {t("login.signUp")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("login.fullName")}</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">{t("login.email")}</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("login.password")}</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t("login.wait") : mode === "signup" ? t("login.signUp") : t("login.signIn")}
        </button>
      </form>
    </div>
  );
}
