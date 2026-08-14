import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Car, Message } from "@/lib/types";
import UserBanButton from "./UserBanButton";
import CarDeleteButton from "./CarDeleteButton";
import ReportActions from "./ReportActions";

type CarRow = Car & { users: { name: string } | null };
type ReportRow = Message & {
  sender: { name: string } | null;
  matches: { user_a_id: string; user_b_id: string } | null;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!me?.is_admin) redirect("/");

  const [{ data: users }, { data: cars }, { data: reports }] = await Promise.all([
    supabase.from("users").select("*").order("created_at", { ascending: false }).returns<AppUser[]>(),
    supabase
      .from("cars")
      .select("*, users(name)")
      .order("created_at", { ascending: false })
      .returns<CarRow[]>(),
    supabase
      .from("messages")
      .select("*, sender:users!messages_sender_id_fkey(name), matches(user_a_id, user_b_id)")
      .eq("kind", "report")
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-semibold mb-1">פאנל אדמין</h1>
        <p className="text-neutral-500">משתמשים, מודעות רכב ודיווחים.</p>
      </div>

      <section>
        <h2 className="font-medium mb-4">דיווחים ({reports?.length ?? 0})</h2>
        <div className="space-y-3">
          {reports?.length ? (
            reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-neutral-200 bg-white px-6 py-5">
                <p className="text-sm text-neutral-500">
                  מאת {r.sender?.name ?? "לא ידוע"} · {new Date(r.created_at).toLocaleString("he-IL")}
                </p>
                <p className="mt-1">{r.text}</p>
                <ReportActions messageId={r.id} senderId={r.sender_id} />
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-sm">אין דיווחים.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">משתמשים ({users?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-right text-neutral-500 border-b border-neutral-200">
                <th className="py-2 pe-4">שם</th>
                <th className="py-2 pe-4">תפקיד</th>
                <th className="py-2 pe-4">עסק</th>
                <th className="py-2 pe-4">פרימיום עד</th>
                <th className="py-2 pe-4">נרשם</th>
                <th className="py-2 pe-4">סטטוס</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100">
                  <td className="py-2 pe-4">{u.name}</td>
                  <td className="py-2 pe-4">{u.role}</td>
                  <td className="py-2 pe-4">{u.business_name ?? "-"}</td>
                  <td className="py-2 pe-4">
                    {u.premium_until ? new Date(u.premium_until).toLocaleDateString("he-IL") : "-"}
                  </td>
                  <td className="py-2 pe-4">{new Date(u.created_at).toLocaleDateString("he-IL")}</td>
                  <td className="py-2 pe-4">
                    {u.is_admin ? (
                      <span className="text-brand-blue-dark">אדמין</span>
                    ) : u.is_banned ? (
                      <span className="text-red-600">חסום</span>
                    ) : (
                      <span className="text-neutral-400">פעיל</span>
                    )}
                  </td>
                  <td className="py-2">
                    {!u.is_admin && <UserBanButton userId={u.id} isBanned={u.is_banned} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">מודעות רכב ({cars?.length ?? 0})</h2>
        <div className="space-y-2">
          {cars?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-6 py-4"
            >
              <div>
                <p className="font-medium">
                  {c.make} {c.model} {c.year ?? ""}
                </p>
                <p className="text-sm text-neutral-500">
                  {c.users?.name ?? "לא ידוע"} · {c.for_sale ? "למכירה" : ""}
                  {c.for_sale && c.for_swap ? " / " : ""}
                  {c.for_swap ? "להחלפה" : ""}
                  {c.price ? ` · ₪${c.price}` : ""}
                </p>
              </div>
              <CarDeleteButton carId={c.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
