import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Brand websites are served from their own domains by the same app.
// BRAND_HOSTS="lumiere.in=lumiere,www.lumiere.in=lumiere"; in development lumiere.localhost:3000 just works.
const BRAND_HOSTS: Record<string, string> = Object.fromEntries(
  (process.env.BRAND_HOSTS ?? "")
    .split(",")
    .map((pair) => pair.trim().split("=") as [string, string])
    .filter(([host, slug]) => host && slug)
    .map(([host, slug]) => [host.toLowerCase(), slug]),
);
if (process.env.NODE_ENV !== "production") BRAND_HOSTS["lumiere.localhost"] ??= "lumiere";

const AUTH_PATHS = ["/dashboard", "/onboarding", "/login"];

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  // 1. Brand domain → the brand site, with clean URLs (/services → /b/lumiere/services).
  const brand = BRAND_HOSTS[host];
  if (brand) {
    // Framework-generated URLs (e.g. opengraph-image) already carry the internal prefix: serve them as they are.
    if (pathname === `/b/${brand}` || pathname.startsWith(`/b/${brand}/`)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/b/${brand}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // 2. Platform domain: refresh the Supabase session and keep signed-out users out of the dashboard.
  if (!AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

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
  matcher: ["/((?!api|_next/static|_next/image|images|videos|widget\\.js|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|mp4|webm|woff2?)$).*)"],
};
