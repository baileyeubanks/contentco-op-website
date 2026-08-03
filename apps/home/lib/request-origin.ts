import { SITE_URL } from "@/lib/seo";

/**
 * Resolve the public site origin for redirects.
 * Behind Cloudflare tunnels / bind-all hosts, `new URL(request.url).origin`
 * can become `https://0.0.0.0:4100` — never use that for Location headers.
 */
export function publicRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const host = forwardedHost?.split(",")[0]?.trim() || "";
  const protoHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLoopback =
    !host ||
    /^0\.0\.0\.0(?::\d+)?$/i.test(host) ||
    /^127\.0\.0\.1(?::\d+)?$/i.test(host) ||
    /^\[::1\](?::\d+)?$/i.test(host) ||
    /^localhost(?::\d+)?$/i.test(host);

  if (host && !isLoopback) {
    const proto =
      protoHeader ||
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.CCO_HOME_URL || SITE_URL).replace(
    /\/+$/,
    "",
  );
  if (envUrl && !/0\.0\.0\.0|127\.0\.0\.1|localhost/i.test(envUrl)) {
    return envUrl;
  }

  return "https://contentco-op.com";
}
