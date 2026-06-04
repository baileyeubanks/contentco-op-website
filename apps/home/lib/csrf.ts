/**
 * Simple CSRF protection for Next.js API routes.
 * Validates Origin/Referer headers match expected host.
 * For state-changing POST/PATCH/DELETE endpoints.
 */

const ALLOWED_ORIGINS = [
  "https://contentco-op.com",
  "https://www.contentco-op.com",
  "https://admin.contentco-op.com",
  "http://localhost:4100",
  "http://127.0.0.1:4100",
];

export function validateCsrf(req: Request): { valid: boolean; error?: string } {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { valid: true };
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Skip validation for webhooks (Stripe sends without origin)
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/webhooks/")) {
    return { valid: true };
  }

  // Development mode: allow localhost only with explicit opt-in
  const allowLocalhost = process.env.ALLOW_LOCALHOST_CSRF === "true";
  if (allowLocalhost && (!origin || origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    return { valid: true };
  }

  if (origin) {
    const allowed = ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o));
    if (allowed) return { valid: true };
  }

  if (referer) {
    const allowed = ALLOWED_ORIGINS.some((o) => referer.startsWith(o));
    if (allowed) return { valid: true };
  }

  return { valid: false, error: `Invalid origin: ${origin || "none"}` };
}
