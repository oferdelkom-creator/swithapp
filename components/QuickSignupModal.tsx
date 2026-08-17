"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { toE164Israel } from "@/lib/phone";
import TradeDetailsForm from "@/components/TradeDetailsForm";

// Shown to a signed-out visitor the moment they act on a real intent (trade or buy),
// instead of bouncing them to the standalone /login page and losing whatever they
// were about to say. Trade intent collects a short description of their own car
// first (via the same TradeDetailsForm the signed-in path uses), then either mode
// collects a phone number and OTP inline - the same signInWithOtp()/verifyOtp() pair
// as the standalone LoginForm.tsx phone flow, just without leaving the deck.
// onAuthenticated fires with the new session's user id (available immediately off
// verifyOtp's response) so the caller can run performSwipe() in place and keep the
// deck moving instead of a full page redirect round trip.
export default function QuickSignupModal({
  candidateMake,
  candidateModel,
  candidatePrice,
  showTradeDetails,
  onCancel,
  onAuthenticated,
}: {
  candidateMake: string;
  candidateModel: string;
  candidatePrice: number | null;
  showTradeDetails: boolean;
  onCancel: () => void;
  onAuthenticated: (userId: string, icebreakerText: string) => void;
}) {
  const { t } = useLocale();
  const [step, setStep] = useState<"trade" | "phone" | "verify">(showTradeDetails ? "trade" : "phone");
  const [icebreaker, setIcebreaker] = useState(t("chat.icebreaker"));
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setStep("verify");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: toE164Israel(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (verifyError || !data.user) {
      setError(verifyError?.message ?? t("login.genericError"));
      return;
    }
    onAuthenticated(data.user.id, icebreaker);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="card p-6 w-full max-w-sm space-y-3 text-sm">
        {step === "trade" && (
          <TradeDetailsForm
            candidateMake={candidateMake}
            candidateModel={candidateModel}
            candidatePrice={candidatePrice}
            submitLabel={t("tradeModal.continue")}
            onCancel={onCancel}
            onSubmit={(text) => {
              setIcebreaker(text);
              setStep("phone");
            }}
          />
        )}

        {step === "phone" && (
          <form onSubmit={handleSendCode} className="space-y-3">
            <p className="font-semibold">{t("quickAuth.title")}</p>
            <p className="text-neutral-500 text-xs">{t("quickAuth.subtitle")}</p>
            <div className="flex" dir="ltr">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-sm font-medium text-neutral-600">
                +972
              </span>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder={t("login.phoneNumberPlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="field w-full rounded-l-none"
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? t("login.wait") : t("login.sendCode")}
              </button>
              <button type="button" onClick={onCancel} className="btn-secondary">
                {t("tradeModal.cancel")}
              </button>
            </div>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <p className="font-semibold">{t("quickAuth.title")}</p>
            <p className="text-neutral-500 text-xs">{t("login.codeSent", { phone: toE164Israel(phone) })}</p>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("login.verificationCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="field w-full"
            />
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? t("login.wait") : t("login.verifyAndContinue")}
              </button>
              <button type="button" onClick={() => setStep("phone")} className="btn-secondary">
                {t("login.changeNumber")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
