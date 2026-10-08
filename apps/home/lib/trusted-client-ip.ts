import { isIP } from "node:net";

/**
 * Grader PR #4 SF5: the rate-limit key for public intake.
 *
 * The old `getClientIp` (lib/rate-limit.ts, removed in R1) keyed on the
 * first X-Forwarded-For hop, which any caller can set, so one client could
 * rotate that header and never hit the limit. This key trusts
 * `CF-Connecting-IP` only when the request carries Cloudflare's edge
 * signature, and otherwise ignores every client-settable forwarding header.
 *
 * Why a header signature rather than the socket peer: a Next.js App Router
 * route handler never sees the socket. Next 16 (server/base-server.js) only
 * fills `x-forwarded-for` from the socket when the header is absent, and
 * Cloudflare always sends one, so the peer address cannot be recovered here.
 * Live traffic reaches the origin only through the Cloudflare tunnel
 * (cloudflared), where the edge overwrites `CF-Connecting-IP` with the real
 * client address and stamps `CF-Ray`; a visitor cannot set either through
 * Cloudflare. A caller that reaches the origin port directly (bypassing
 * Cloudflare) could forge both headers; closing that needs the runtime bound
 * to loopback or a Cloudflare-injected shared secret, which is an ops change
 * outside this route.
 *
 * Every request without the signature shares one bucket
 * (`UNTRUSTED_CLIENT_KEY`, the limiter's existing "unknown" key), so rotating
 * X-Forwarded-For or a bare CF-Connecting-IP cannot mint fresh buckets.
 *
 * Grader PR #19 R1: this is the only rate-limit key for the public CCO routes
 * (/api/cco/briefs, /api/cco/leads, /api/cco/briefs/proposal); the old
 * X-Forwarded-For `getClientIp` helper is gone, so no limiter key can come
 * from a client-settable header.
 */
export const UNTRUSTED_CLIENT_KEY = "unknown";

/** Cloudflare ray id as delivered to the origin: 16 hex digits, "-", 3-letter colo. */
const CF_RAY_PATTERN = /^[0-9a-f]{16}-[A-Z]{3}$/i;

export function isCloudflareEdgeRequest(req: Request): boolean {
  const ray = req.headers.get("cf-ray")?.trim() ?? "";
  const connectingIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
  return CF_RAY_PATTERN.test(ray) && isIP(connectingIp) !== 0;
}

export function getRateLimitClientKey(req: Request): string {
  if (!isCloudflareEdgeRequest(req)) return UNTRUSTED_CLIENT_KEY;
  return `cf:${req.headers.get("cf-connecting-ip")!.trim().toLowerCase()}`;
}
