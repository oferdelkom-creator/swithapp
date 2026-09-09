"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPermanentPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("הסיסמה צריכה להכיל לפחות 10 תווים.");
      return;
    }
    if (password !== confirmation) {
      setError("הסיסמאות אינן זהות.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("לא הצלחנו לשמור את הסיסמה. פתחו שוב את קישור ההזמנה או פנו אלינו לעזרה.");
      setLoading(false);
      return;
    }
    router.push("/business");
    router.refresh();
  }

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[#07111f] px-4 py-12 text-white">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-neutral-900 shadow-2xl sm:p-8" dir="rtl">
        <p className="text-sm font-bold text-cyan-600">הפעלת החשבון העסקי</p>
        <h1 className="mt-2 text-2xl font-black">בחרו סיסמה קבועה</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          קישור הכניסה שקיבלתם מיועד להפעלה ראשונית בלבד. בחרו כעת סיסמה אישית שתשמש אתכם בכניסות הבאות.
        </p>
        <form onSubmit={savePassword} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">סיסמה חדשה</label>
            <input required type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} className="field w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">אימות הסיסמה</label>
            <input required type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="field w-full" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">
            {loading ? "שומרים…" : "שמירת הסיסמה וכניסה לפאנל"}
          </button>
        </form>
      </div>
    </main>
  );
}
