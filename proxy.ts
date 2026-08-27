import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/config";
import { LOCALE_COOKIE, isLocale, parseAcceptLanguage } from "./lib/i18n/locale";
import { PARTNER_SITE_URL, isPartnerHostname, normalizeHostname } from "./lib/partnerSite";

// /swipe is deliberately not here - sale-mode browsing needs no account (mirrors
// /d/[slug] being open to signed-out visitors), and SwipeDeck.tsx itself gates the
// swap tab and any real action (Trade/Buy) behind an inline sign-up prompt instead.
const PROTECTED_PREFIXES = ["/admin", "/matches", "/likes"];

function isBusinessRouteProtected(pathname: string): boolean {
  // The partner page and its signup form are sales pages, so a prospect must be
  // able to reach them before creating an account. The actual business dashboard
  // remains private.
  return pathname.startsWith("/business") && !pathname.startsWith("/business/join");
}

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
const FIRST_PARTY_HOST_SUFFIXES = [".vercel.app", "localhost"];
const CONSUMER_HOSTS = new Set([
  "switchapp.co.il",
  "www.switchapp.co.il",
]);
const ADMIN_HOSTS = new Set([
  "switchapp.info",
  "www.switchapp.info",
]);

async function lookupDealerSlug(column: "dealer_slug" | "custom_domain", value: string, activeDomainOnly = false): Promise<string | null> {
  const activeFilter = activeDomainOnly ? "&custom_domain_active=eq.true" : "";
  const lookupUrl =
    `${SUPABASE_URL}/rest/v1/users?select=dealer_slug&${column}=eq.${encodeURIComponent(value)}` +
    `${activeFilter}&role=in.(dealer,importer)&limit=1`;
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

async function resolveCustomDomainSlug(host: string): Promise<string | null> {
  const hostname = normalizeHostname(host);
  if (hostname.endsWith(".switchapp.co.il")) {
    const slug = hostname.slice(0, -".switchapp.co.il".length);
    if (slug && slug !== "www" && !slug.includes(".")) return lookupDealerSlug("dealer_slug", slug);
    return null;
  }
  if (
    hostname === "switchapp.co.il" ||
    hostname === "www.switchapp.co.il" ||
    ADMIN_HOSTS.has(hostname) ||
    isPartnerHostname(hostname) ||
    FIRST_PARTY_HOST_SUFFIXES.some((suffix) => hostname.includes(suffix))
  ) return null;

  // A raw REST call instead of the supabase-js client - this is a single anonymous
  // read (RLS allows "select using (true)" on users), and avoids pulling in a client
  // built around browser storage APIs that don't exist in the edge runtime.
  return lookupDealerSlug("custom_domain", hostname, true);
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const partnerHost = isPartnerHostname(host);
  const pathname = request.nextUrl.pathname;

  if (partnerHost) {
    const publicToInternal: Record<string, string> = {
      "/": "/business/join",
      "/login": "/business/login",
      "/signup": "/business/join/signup",
      "/dashboard": "/business",
    };
    const internalPath = publicToInternal[pathname];
    if (internalPath) {
      const url = request.nextUrl.clone();
      url.pathname = internalPath;
      return NextResponse.rewrite(url);
    }

    const consumerPrefixes = ["/swipe", "/likes", "/matches", "/profile"];
    if (consumerPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return NextResponse.redirect(new URL(pathname, "https://www.switchapp.co.il"));
    }
  } else if (ADMIN_HOSTS.has(normalizeHostname(host))) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    const consumerPrefixes = ["/swipe", "/likes", "/matches", "/profile"];
    if (consumerPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return NextResponse.redirect(new URL(pathname, "https://www.switchapp.co.il"));
    }
  } else if (CONSUMER_HOSTS.has(normalizeHostname(host)) && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/swipe";
    return NextResponse.redirect(url);
  } else if (host.includes("switchapp.co.il") && pathname.startsWith("/business")) {
    const partnerPath = pathname === "/business/join"
      ? "/"
      : pathname === "/business/join/signup"
        ? "/signup"
        : pathname === "/business/login"
          ? "/login"
          : pathname === "/business"
            ? "/dashboard"
            : pathname;
    return NextResponse.redirect(new URL(partnerPath, PARTNER_SITE_URL));
  }

  const dealerSlug = await resolveCustomDomainSlug(host);

  let response = NextResponse.next({ request });

  // English is the default; a returning visitor's browser language (via Accept-Language,
  // the closest thing to "location of use" available without a geo-IP lookup) picks the
  // locale once, then the cookie is authoritative - the language switcher overrides it
  // explicitly after that. Applied to whichever response actually gets returned below,
  // since the Supabase cookie handler may swap `response` out for a new object.
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const isArabicRoute = request.nextUrl.pathname === "/ar" || request.nextUrl.pathname.startsWith("/ar/");
  const isEinavShowroom = request.nextUrl.pathname === "/d/einav-luxury";
  const forcedLocale = isArabicRoute ? "ar" : isEinavShowroom ? "he" : null;
  const resolvedLocale = forcedLocale ?? (isLocale(existingLocale)
    ? existingLocale
    : parseAcceptLanguage(request.headers.get("accept-language")));
  if (forcedLocale && existingLocale !== forcedLocale) request.cookies.set(LOCALE_COOKIE, forcedLocale);

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
    isBusinessRouteProtected(request.nextUrl.pathname) ||
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

  if (!isLocale(existingLocale) || forcedLocale) {
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|google602488ab11227623.html).*)",
  ],
};
