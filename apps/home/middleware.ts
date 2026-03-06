import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: refreshes Supabase auth session on every request.
 * Redirects unauthenticated users away from /root areas to /root/login.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      request.nextUrl.pathname === "/dashboard"
        ? "/root/overview"
        : request.nextUrl.pathname.replace(/^\/dashboard/, "/root");
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/root/login";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — IMPORTANT: must call getUser() not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /root routes except entry + login
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/root") &&
    request.nextUrl.pathname !== "/root" &&
    request.nextUrl.pathname !== "/root/login"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/root/login";
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /root/login, redirect to root overview
  if (user && request.nextUrl.pathname === "/root/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/root/overview";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/root/:path*"],
};
