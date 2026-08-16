import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import LocaleProvider from "@/components/LocaleProvider";
import MatchNotifier from "@/components/MatchNotifier";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Inter has no Hebrew glyphs, so Hebrew text falls through to the system-font
// fallbacks in globals.css automatically - only Latin/Cyrillic (en/ru) render in Inter.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("users")
          .select("is_admin, role, notify_on_match")
          .eq("id", user.id)
          .maybeSingle<{ is_admin: boolean; role: string; notify_on_match: boolean }>()
      ).data
    : null;
  const isAdmin = profile?.is_admin ?? false;
  const isBusiness = profile?.role === "dealer" || profile?.role === "importer";

  const likesCount = user
    ? ((await supabase.rpc("count_incoming_likes", { my_id: user.id })).data as number | null)
    : null;
  const unreadMatches = user
    ? ((await supabase.rpc("count_unread_matches", { my_id: user.id })).data as number | null)
    : null;

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider locale={locale}>
          <Header loggedIn={!!user} />
          <main className={`flex-1 ${user ? "pb-20" : ""}`}>{children}</main>
          {user && (
            <BottomNav
              isAdmin={isAdmin}
              isBusiness={isBusiness}
              likesCount={likesCount}
              unreadMatches={unreadMatches}
            />
          )}
          {user && <MatchNotifier userId={user.id} enabled={profile?.notify_on_match ?? false} />}
          {user && <PresenceHeartbeat userId={user.id} />}
        </LocaleProvider>
      </body>
    </html>
  );
}
