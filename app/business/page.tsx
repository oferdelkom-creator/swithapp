import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/business");

  const { data: me } = await supabase
    .from("users")
    .select("role, business_name, billing_plan, subscription_valid_until")
    .eq("id", user.id)
    .maybeSingle<{
      role: string;
      business_name: string | null;
      billing_plan: string | null;
      subscription_valid_until: string | null;
    }>();

  if (!me || (me.role !== "dealer" && me.role !== "importer")) redirect("/");

  const active = me.subscription_valid_until && new Date(me.subscription_valid_until) > new Date();

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">חשבון עסקי</h1>
      <p className="text-neutral-500 mb-8 text-sm">{me.business_name ?? "-"}</p>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-2 text-sm">
        <p>
          תוכנית: <span className="font-medium">{me.billing_plan ?? "לא הוגדרה"}</span>
        </p>
        <p>
          מנוי: {active ? (
            <span className="text-emerald-700 font-medium">
              פעיל עד {new Date(me.subscription_valid_until!).toLocaleDateString("he-IL")}
            </span>
          ) : (
            <span className="text-red-600 font-medium">לא פעיל</span>
          )}
        </p>
        <p className="text-neutral-500 pt-2">
          אין עדיין תשלום עצמאי באפליקציה - הפעלת/חידוש מנוי נעשית מול הצוות שלנו.
        </p>
      </div>
    </div>
  );
}
