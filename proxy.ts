import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/config";
import { LOCALE_COOKIE, isLocale, parseAcceptLanguage } from "./lib/i18n/locale";

const PROTECTED_PREFIXES = ["/admin", "/cars", "/swipe", "/matches", "/likes", "/business"];

export async function proxy(request: NextRequest) {
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

  const isProtected = PROTECTED_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
