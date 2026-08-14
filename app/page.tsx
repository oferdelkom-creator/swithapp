import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("cars")
    .select("id", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-blue-dark">SwitchApp</h1>
      <p className="mt-2 text-neutral-600">
        סווייפ ימינה או שמאלה כדי למכור, לקנות או להחליף רכב עם בעלים אחרים.
      </p>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-sm text-neutral-500">
          מחובר ל-Supabase (switchapp) — {count ?? 0} רכבים רשומים כרגע.
        </p>
      </div>

      <p className="mt-8 text-sm text-neutral-400">
        זהו שלד ראשוני. מסכי הסווייפ, ההתאמות והצ&apos;אט עדיין לא בנויים — ראו README.
      </p>
    </div>
  );
}
