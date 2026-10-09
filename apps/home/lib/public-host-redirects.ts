/**
 * Canon host map (`CCO_PRODUCT_CANON.md`):
 * - contentco-op.com = public Cream Editorial. No operator shell.
 * - admin.contentco-op.com = CCO OS (`/os/*`).
 * - client.contentco-op.com = Co-VideoPro client role.
 *
 * Public `/os` and `/login` on the marketing host are not intended.
 * These Next.js redirects send them to the canonical hosts.
 */

export const ADMIN_OS_ORIGIN = "https://admin.contentco-op.com";
export const CLIENT_CVP_ORIGIN = "https://client.contentco-op.com";
export const PUBLIC_SITE_HOSTS = ["contentco-op.com", "www.contentco-op.com"] as const;

export type PublicCanonHostRedirect = {
  source: string;
  has: [{ type: "host"; value: string }];
  destination: string;
  statusCode: 303 | 307;
};

function hostRedirect(
  host: string,
  source: string,
  destination: string,
  statusCode: 303 | 307,
): PublicCanonHostRedirect {
  return {
    source,
    has: [{ type: "host", value: host }],
    destination,
    statusCode,
  };
}

export const publicCanonHostRedirects: PublicCanonHostRedirect[] = PUBLIC_SITE_HOSTS.flatMap((host) => [
  // 303 so a POSTed public /login body is not forwarded to the client host.
  hostRedirect(host, "/login", `${CLIENT_CVP_ORIGIN}/login`, 303),
  hostRedirect(host, "/os", `${ADMIN_OS_ORIGIN}/os`, 307),
  hostRedirect(host, "/os/:path*", `${ADMIN_OS_ORIGIN}/os/:path*`, 307),
]);

export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "");
}

export function isPublicMarketingHost(hostname: string): boolean {
  return (PUBLIC_SITE_HOSTS as readonly string[]).includes(normalizeHostname(hostname));
}

export function publicCanonRedirectTarget(hostname: string, pathname: string): string | null {
  if (!isPublicMarketingHost(hostname)) return null;
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return `${CLIENT_CVP_ORIGIN}/login`;
  }
  if (pathname === "/os" || pathname.startsWith("/os/")) {
    return `${ADMIN_OS_ORIGIN}${pathname}`;
  }
  return null;
}
