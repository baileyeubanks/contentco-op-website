// At the SF5 rebase, switch clientLinkClientKey to getRateLimitClientKey
// from trusted-client-ip.ts. No forwarded chain is accepted here.
import { isIP } from "node:net";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
export const CLIENT_LINK_LIMIT = 30;
export const CLIENT_LINK_WINDOW_MS = 60_000;
export function clientLinkClientKey(source: { get(name: string): string | null }): string {
  const ray = source.get("cf-ray"), ip = source.get("cf-connecting-ip");
  return ray && /^[0-9a-f]{16}-[A-Z]{3}$/i.test(ray) && ip && isIP(ip) ? ip : "unknown";
}
function allowed(source: { get(name: string): string | null }, scope: string): boolean {
  return rateLimit(`cco-client-link:${scope}:${clientLinkClientKey(source)}`, {
    max: CLIENT_LINK_LIMIT, windowMs: CLIENT_LINK_WINDOW_MS,
  }).success;
}
export function clientLinkRateLimit(req: Request, scope: string) {
  return allowed(req.headers, scope) ? null : NextResponse.json({ error: "rate_limited" }, {
    status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}
export async function clientLinkPageAllowed(scope: string): Promise<boolean> {
  return allowed(await headers(), scope);
}
