"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// Normalizes an Israeli local number ("050-1234567", "0501234567") or an
// already-international one ("+972501234567") into E.164 for Supabase's phone auth.
function toE164Israel(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [authMethod, setAuthMethod] = useState<"welcome" | "password" | "phone">("welcome");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "verify">("enter");
  const [code, setCode] = useState("");

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const next = searchParams.get("next") || "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toE164Israel(phone) });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setPhoneStep("verify");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: toE164Israel(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    const next = searchParams.get("next") || "/";
    router.push(next);
    router.refresh();
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

  if (authMethod === "welcome") {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] bg-gradient-to-b from-brand-blue to-brand-blue-dark flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-white">
          <div className="flex items-center gap-2">
            <SwapIcon />
            <span className="text-4xl font-extrabold tracking-tight">SwitchApp</span>
          </div>
          <p className="mt-3 text-white/80 text-sm max-w-xs">{t("login.heroTagline")}</p>
        </div>
        <div className="px-6 pb-10 space-y-4">
          <p className="text-center text-[11px] leading-relaxed text-white/70">{t("login.termsDisclaimer")}</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full rounded-full bg-white text-neutral-900 py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
            >
              <GoogleIcon />
              {t("login.continueWithGoogle")}
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("phone")}
              className="w-full rounded-full bg-white/15 text-white py-3 text-sm font-medium hover:bg-white/25 transition-colors"
            >
              {t("login.continueWithPhone")}
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("password")}
              className="w-full rounded-full bg-white/15 text-white py-3 text-sm font-medium hover:bg-white/25 transition-colors"
            >
              {t("login.continueWithEmail")}
            </button>
          </div>
          <p className="text-center text-xs text-white/70">
            {t("login.dealerCtaText")}{" "}
            <Link href="/business/join" className="underline">
              {t("login.dealerCtaLink")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (authMethod === "phone") {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <button
          type="button"
          onClick={() => {
            setAuthMethod("password");
            setPhoneStep("enter");
            setError(null);
          }}
          className="text-sm text-brand-blue mb-4"
        >
          {t("login.backToEmail")}
        </button>

        <div className="card p-6">
          {phoneStep === "enter" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("login.phoneNumber")}</label>
                <input
                  required
                  type="tel"
                  placeholder={t("login.phoneNumberPlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t("login.wait") : t("login.sendCode")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-muted">{t("login.codeSent", { phone: toE164Israel(phone) })}</p>
              <div>
                <label className="block text-sm font-medium mb-1">{t("login.verificationCode")}</label>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t("login.wait") : t("login.verifyAndContinue")}
              </button>
              <button type="button" onClick={() => setPhoneStep("enter")} className="text-sm text-brand-blue">
                {t("login.changeNumber")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <button type="button" onClick={() => setAuthMethod("welcome")} className="text-sm text-brand-blue mb-4">
        {t("login.backToWelcome")}
      </button>
      <h1 className="text-2xl font-semibold mb-2">{t("login.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{t("login.subtitle")}</p>
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

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGoogle}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            {t("login.continueWithGoogle")}
          </button>
          <button type="button" onClick={() => setAuthMethod("phone")} className="btn-secondary w-full">
            {t("login.continueWithPhone")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SwapIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 7h11l-3-3" />
      <path d="M17 17H6l3 3" />
    </svg>
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
