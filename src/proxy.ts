import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// One app serves both the Lumière website (/, /services, /book …) and the staff screens (/login, /dashboard).

// When set, every other address (e.g. the *.vercel.app one) forwards visitors to this single main address.
// APIs (/api/…, incl. the Vapi phone webhook) keep working on every address.
const PRIMARY_SITE = (() => {
  try {
    return process.env.PRIMARY_SITE_URL ? new URL(process.env.PRIMARY_SITE_URL) : null;
  } catch {
    return null;
  }
})();

/** Staff screens. */
const STAFF_PATHS = ["/dashboard", "/login"];
const isStaffPath = (p: string) => STAFF_PATHS.some((s) => p === s || p.startsWith(`${s}/`));

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  // 1. Any other address → the main address (same path), so guests and staff share one place.
  if (PRIMARY_SITE && host !== PRIMARY_SITE.hostname) {
    const url = new URL(`${pathname}${request.nextUrl.search}`, PRIMARY_SITE);
    return NextResponse.redirect(url, 307);
  }

  // 2. Staff screens: refresh the login and keep signed-out visitors out of the dashboard.
  if (isStaffPath(pathname)) return staffGate(request, pathname);

  return NextResponse.next();
}

/** Refresh the Supabase session and keep signed-out visitors out of the dashboard. */
async function staffGate(request: NextRequest, pathname: string) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Everything except API routes, build assets, public media and the embeddable widget script.
  matcher: ["/((?!api|_next/static|_next/image|images|videos|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|mp4|webm|woff2?)$).*)"],
};
