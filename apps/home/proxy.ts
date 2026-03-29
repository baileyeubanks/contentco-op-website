import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdvancedRootOperatorForHost, isEmailAuthorizedForRootHost } from "@/lib/root-auth";
import { resolvePublicSupabaseConfig } from "@/lib/runtime-config";
import { verifyInviteSessionEdge } from "@/lib/session-edge";
import { getSessionCookieName } from "@/lib/session-shared";

const ADVANCED_ROOT_PATHS = ["/root/system", "/root/lab", "/root/work-claims"];
const PUBLIC_ROOT_PATHS = new Set(["/root", "/root/login", "/root/logout"]);

/**
 * Middleware: refreshes Supabase auth session on every request.
 * Redirects unauthenticated users away from protected /root areas to /root.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      request.nextUrl.pathname === "/dashboard"
        ? "/root/overview"
        : request.nextUrl.pathname.replace(/^\/dashboard/, "/root");
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
  // partially-authorized session cookie is present. `/root` remains the smart
  // entrypoint; `/root/login` and `/root/logout` must stay deterministic.
  if (request.nextUrl.pathname === "/root/login" || request.nextUrl.pathname === "/root/logout") {
    return supabaseResponse;
  }

  if (
    request.nextUrl.pathname.startsWith("/root") &&
    ADVANCED_ROOT_PATHS.some((route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)) &&
    !advancedAuthorized
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/root/overview";
    url.searchParams.set("denied", "advanced");
    return NextResponse.redirect(url);
  }

  // Protect /root routes except entry
  if (
    !user &&
    !operatorAuthorized &&
    request.nextUrl.pathname.startsWith("/root") &&
    !PUBLIC_ROOT_PATHS.has(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/root";
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith("/root") && user && !userAuthorized && !operatorAuthorized) {
    const url = request.nextUrl.clone();
    url.pathname = "/root";
    return NextResponse.redirect(url);
  }

  if ((userAuthorized || operatorAuthorized) && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/root/overview";
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /root, redirect to root overview
  if ((userAuthorized || operatorAuthorized) && PUBLIC_ROOT_PATHS.has(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/root/overview";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/root", "/root/:path*"],
};
