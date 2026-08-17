import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/config";
import { LOCALE_COOKIE, isLocale, parseAcceptLanguage } from "./lib/i18n/locale";

// /swipe is deliberately not here - sale-mode browsing needs no account (mirrors
// /d/[slug] being open to signed-out visitors), and SwipeDeck.tsx itself gates the
// swap tab and any real action (Trade/Buy) behind an inline sign-up prompt instead.
const PROTECTED_PREFIXES = ["/admin", "/matches", "/likes", "/business"];

// /cars needs finer-grained handling than a flat prefix: "/cars" itself (manage your
// own listings) and "/cars/[id]/edit" stay behind login, but "/cars/[id]" (the read-only
// detail view, reachable from the deck's info button) is open to signed-out visitors,
// same as /swipe and /d/[slug] - the whole point of that button is letting a visitor
// read everything about a car before deciding whether to sign up and act on it.
function isCarsRouteProtected(pathname: string): boolean {
  if (pathname === "/cars") return true;
  return /^\/cars\/[^/]+\/edit(\/|$)/.test(pathname);
}

// Lets a dealer point their own domain at their /d/[slug] page instead of
// switchapp.vercel.app/d/[slug] (added 2026-08-16 alongside users.custom_domain /
// custom_domain_active). Our own hosts always short-circuit before the lookup, so this
// can't add latency to normal traffic; an unmatched host just returns null and
// ordinary routing continues, which for an unrecognized domain naturally means nothing
// points at us in the first place.
//
// switchapp.co.il (added 2026-08-16, same day) is our own primary domain, not a
// dealer's - listed explicitly so it never takes the extra DB round trip on every
// request once DNS/Vercel are pointed at it.
const FIRST_PARTY_HOST_SUFFIXES = [".vercel.app", "localhost", "switchapp.co.il"];

async function resolveCustomDomainSlug(host: string): Promise<string | null> {
  if (FIRST_PARTY_HOST_SUFFIXES.some((suffix) => host.includes(suffix))) return null;

  // A raw REST call instead of the supabase-js client - this is a single anonymous
  // read (RLS allows "select using (true)" on users), and avoids pulling in a client
  // built around browser storage APIs that don't exist in the edge runtime.
  const lookupUrl =
    `${SUPABASE_URL}/rest/v1/users?select=dealer_slug&custom_domain=eq.${encodeURIComponent(host)}` +
    `&custom_domain_active=eq.true&limit=1`;
  try {
    const res = await fetch(lookupUrl, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { dealer_slug: string | null }[];
    return rows[0]?.dealer_slug ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const dealerSlug = await resolveCustomDomainSlug(request.headers.get("host") ?? "");

  let response = NextResponse.next({ request });

  // English is the default; a returning visitor's browser language (via Accept-Language,
  // the closest thing to "location of use" available without a geo-IP lookup) picks the
  // locale once, then the cookie is authoritative - the language switcher overrides it
  // explicitly after that. Applied to whichever response actually gets returned below,
  // since the Supabase cookie handler may swap `response` out for a new object.
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const resolvedLocale = isLocale(existingLocale)
    ? existingLocale
    : parseAcceptLanguage(request.headers.get("accept-language"));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
    PROTECTED_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p)) ||
    isCarsRouteProtected(request.nextUrl.pathname);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(url);
    if (!isLocale(existingLocale)) {
      redirectResponse.cookies.set(LOCALE_COOKIE, resolvedLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return redirectResponse;
  }

  if (!isLocale(existingLocale)) {
    response.cookies.set(LOCALE_COOKIE, resolvedLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  if (dealerSlug) {
    const url = request.nextUrl.clone();
    url.pathname = `/d/${dealerSlug}`;
    const rewritten = NextResponse.rewrite(url, { request });
    response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
    return rewritten;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
