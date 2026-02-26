import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED = ["/login", "/api/auth/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALLOWED.some((path) => pathname.startsWith(path)) || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const session = req.cookies.get("cco_session")?.value;
  if (!session || !session.startsWith("invited:")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};

