import { posix } from "node:path";
import { CLIENT_CVP_ORIGIN, isPublicMarketingHost } from "@/lib/public-host-redirects";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdvancedRootOperatorForHost, isEmailAuthorizedForRootHost } from "@/lib/os-auth";
import { resolvePublicSupabaseConfig } from "@/lib/runtime-config";
import { verifyInviteSessionEdge } from "@/lib/session-edge";
import { getSessionCookieName } from "@/lib/session-shared";

// CVP lib/review-links/short-link.ts: one branded slug/version/key segment
// (14–80 characters), or the private review-<10-character key> form.
const CVP_SHORT_REVIEW_PATH = /^\/(?:(?=[a-z0-9-]{14,80}$)[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]{0,5}-[a-z0-9]{10}|review-[a-z0-9]{10})$/;

const ADVANCED_ROOT_PATHS = ["/os/system", "/os/lab", "/os/work-claims"];
const PUBLIC_ROOT_PATHS = new Set(["/os", "/os/login", "/os/logout"]);

/**
 * Middleware: refreshes Supabase auth session on every request.
 * Redirects unauthenticated users away from protected /root areas to /root.
 */
export async function proxy(request: NextRequest) {
  const reviewPath = request.nextUrl.pathname;
  if ((request.method === "GET" || request.method === "HEAD")
    && isPublicMarketingHost(request.nextUrl.hostname)
    && (reviewPath.startsWith("/review/") || CVP_SHORT_REVIEW_PATH.test(reviewPath))) {
    // Assign path/query separately: bearer paths and redirect-like query values
    // can never choose the destination origin. No token lookup or logging here.
    const destination = new URL(CLIENT_CVP_ORIGIN);
    destination.pathname = reviewPath;
    destination.search = request.nextUrl.search;
    const response = NextResponse.redirect(destination, 308);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  // The legacy manifest lives under public/. Do not leave a static-file bypass
  // around the operator-only API; ordinary public media assets are unaffected.
  let pathname = request.nextUrl.pathname;
  try { pathname = posix.normalize(decodeURIComponent(pathname).replace(/\\/g, "/")).toLowerCase().replace(/\/+$/, ""); }
  catch { return new NextResponse(null, { status: 400 }); }
  if (pathname === "/media/thumbnail-manifest.json") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/media/thumbnail/approved";
    return NextResponse.rewrite(url);
  }
  // Match globally to cover encoded static filenames, but do no auth work for
  // ordinary public pages/assets/APIs. Preserve the existing protected surfaces.
  const originalPath = request.nextUrl.pathname;
  if (!(originalPath === "/login" || originalPath === "/os" || originalPath.startsWith("/os/") || originalPath === "/dashboard" || originalPath.startsWith("/dashboard/"))) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      request.nextUrl.pathname === "/dashboard"
        ? "/os/overview"
        : request.nextUrl.pathname.replace(/^\/dashboard/, "/os");
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });
  let user: { id: string; email?: string | null } | null = null;
  const publicSupabase = resolvePublicSupabaseConfig();

  if (publicSupabase.isConfigured && publicSupabase.url && publicSupabase.anonKey) {
    const supabase = createServerClient(publicSupabase.url, publicSupabase.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });

    try {
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      user = supabaseUser;
    } catch {
      supabaseResponse.headers.set("x-root-runtime-status", "degraded");
      supabaseResponse.headers.set("x-root-runtime-reason", "supabase_auth_probe_failed");
    }
  } else {
    supabaseResponse.headers.set("x-root-runtime-status", "degraded");
    supabaseResponse.headers.set("x-root-runtime-reason", "missing_public_supabase_env");
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  const operatorSession = await verifyInviteSessionEdge(request.cookies.get(getSessionCookieName())?.value);
  const operatorAuthorized = operatorSession ? isEmailAuthorizedForRootHost(operatorSession.email, host) : false;
  const userAuthorized = user?.email ? isEmailAuthorizedForRootHost(user.email, host) : false;
  const advancedAuthorized =
    (operatorSession ? isAdvancedRootOperatorForHost(operatorSession.email, host) : false) ||
    (user?.email ? isAdvancedRootOperatorForHost(user.email, host) : false);

  // Keep the explicit auth recovery routes reachable even if a stale or
  // partially-authorized session cookie is present. `/os` remains the smart
  // entrypoint; `/os/login` and `/os/logout` must stay deterministic.
  if (request.nextUrl.pathname === "/os/login" || request.nextUrl.pathname === "/os/logout") {
    return supabaseResponse;
  }

  if (
    request.nextUrl.pathname.startsWith("/os") &&
    ADVANCED_ROOT_PATHS.some((route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)) &&
    !advancedAuthorized
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/os/overview";
    url.searchParams.set("denied", "advanced");
    return NextResponse.redirect(url);
  }

  // Protect /root routes except entry
  if (
    !user &&
    !operatorAuthorized &&
    request.nextUrl.pathname.startsWith("/os") &&
    !PUBLIC_ROOT_PATHS.has(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/os";
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith("/os") && user && !userAuthorized && !operatorAuthorized) {
    const url = request.nextUrl.clone();
    url.pathname = "/os";
    return NextResponse.redirect(url);
  }

  if ((userAuthorized || operatorAuthorized) && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/os/overview";
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /root, redirect to root overview
  if ((userAuthorized || operatorAuthorized) && PUBLIC_ROOT_PATHS.has(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/os/overview";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/:path*"],
};
