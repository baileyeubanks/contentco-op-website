import { posix } from "node:path";
import { CLIENT_CVP_ORIGIN, adminHostRedirectTarget, isPublicMarketingHost } from "@/lib/public-host-redirects";
import { NextResponse, type NextRequest } from "next/server";

// CVP lib/review-links/short-link.ts: one branded slug/version/key segment
// (14–80 characters), or the private review-<10-character key> form.
const CVP_SHORT_REVIEW_PATH = /^\/(?:(?=[a-z0-9-]{14,80}$)[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]{0,5}-[a-z0-9]{10}|review-[a-z0-9]{10})$/;

/**
 * Proxy: redirects the retired admin host to Co-VideoPro, hands marketing-host
 * review links to Co-VideoPro and serves the approved thumbnail manifest.
 */
export async function proxy(request: NextRequest) {
  // admin.contentco-op.com is retired. Host header only (the tunnel sets it);
  // x-forwarded-host is client-controllable and is never consulted.
  const adminTarget = adminHostRedirectTarget(request.headers.get("host"));
  if (adminTarget) {
    const response = NextResponse.redirect(adminTarget, 307);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const reviewPath = request.nextUrl.pathname;
  if ((request.method === "GET" || request.method === "HEAD")
    && isPublicMarketingHost(request.headers.get("host") ?? "")
    && (reviewPath.startsWith("/review/") || CVP_SHORT_REVIEW_PATH.test(reviewPath))) {
    // Assign path/query separately: bearer paths and redirect-like query values
    // can never choose the destination origin. No token lookup or logging here.
    const destination = new URL(CLIENT_CVP_ORIGIN);
    destination.pathname = reviewPath;
    destination.search = new URL(request.url).search;
    const response = NextResponse.redirect(destination, 308);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
