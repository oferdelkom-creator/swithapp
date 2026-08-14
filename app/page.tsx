import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const [{ count }, { data: auth }] = await Promise.all([
    supabase.from("cars").select("id", { count: "exact", head: true }),
    supabase.auth.getUser(),
  ]);

  const isAdmin = auth.user
    ? (
        await supabase.from("users").select("is_admin").eq("id", auth.user.id).maybeSingle<{
          is_admin: boolean;
        }>()
      ).data?.is_admin
    : false;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brand-blue-dark">SwitchApp</h1>
        <nav className="flex gap-4 text-sm">
          {auth.user ? (
            <>
              <Link href="/swipe" className="underline text-brand-blue">
                סווייפ
              </Link>
              <Link href="/cars" className="underline text-brand-blue">
                הרכבים שלי
              </Link>
              {isAdmin && (
                <Link href="/admin" className="underline text-brand-blue">
                  אדמין
                </Link>
              )}
            </>
          ) : (
            <Link href="/login" className="underline text-brand-blue">
              התחברות
            </Link>
          )}
        </nav>
      </div>
      <p className="mt-2 text-neutral-600">
        סווייפ ימינה או שמאלה כדי למכור, לקנות או להחליף רכב עם בעלים אחרים.
      </p>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-sm text-neutral-500">
          מחובר ל-Supabase (switchapp) — {count ?? 0} רכבים רשומים כרגע.
        </p>
      </div>
    </div>
  );
}
