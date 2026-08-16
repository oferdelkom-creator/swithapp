"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

export default function SignOutButton() {
  const { t } = useLocale();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="text-sm text-neutral-500 hover:text-neutral-700">
      {t("nav.signOut")}
    </button>
  );
}
