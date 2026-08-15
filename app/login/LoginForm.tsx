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

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const next = searchParams.get("next") || "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        // name goes in user metadata; a DB trigger creates the public.users
        // row from it the moment the auth user is created, so it exists even
        // if email confirmation delays the session. emailRedirectTo points the
        // confirmation link at our own callback route (instead of Supabase's default,
        // which has nothing to exchange the code for a session) - without this, clicking
        // the confirmation link never actually logged anyone in.
        const next = searchParams.get("next") || "/";
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
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

      <div className="flex items-center gap-3 my-4 text-xs text-muted">
        <div className="flex-1 border-t border-neutral-200" />
        {t("login.orContinueWith")}
        <div className="flex-1 border-t border-neutral-200" />
      </div>

      <button type="button" onClick={handleGoogle} className="btn-secondary w-full flex items-center justify-center gap-2">
        <GoogleIcon />
        {t("login.continueWithGoogle")}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.7 27 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.5 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
