import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("users")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle<{ is_admin: boolean; role: string }>()
      ).data
    : null;
  const isAdmin = profile?.is_admin ?? false;
  const isBusiness = profile?.role === "dealer" || profile?.role === "importer";

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand-blue-dark tracking-tight">
          SwitchApp
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              <NavLink href="/swipe">סווייפ</NavLink>
              <NavLink href="/cars">הרכבים שלי</NavLink>
              <NavLink href="/matches">התאמות</NavLink>
              <NavLink href="/likes">מי אהב אותך</NavLink>
              {isBusiness && <NavLink href="/business">חשבון עסקי</NavLink>}
              {isAdmin && <NavLink href="/admin">אדמין</NavLink>}
            </>
          ) : (
            <NavLink href="/login" primary>
              התחברות
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-full bg-brand-blue text-white px-4 py-1.5 hover:bg-brand-blue-dark transition-colors"
          : "rounded-full px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-brand-blue-dark transition-colors"
      }
    >
      {children}
    </Link>
  );
}
