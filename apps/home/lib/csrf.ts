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

function parseOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isExplicitLocalOrigin(value: string | null) {
  const origin = parseOrigin(value);
  if (!origin) return false;
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isAllowedOrigin(value: string | null) {
  const origin = parseOrigin(value);
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

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
  if (allowLocalhost && isExplicitLocalOrigin(origin)) {
    return { valid: true };
  }

  if (isAllowedOrigin(origin)) return { valid: true };

  if (isAllowedOrigin(referer)) return { valid: true };

  return { valid: false, error: `Invalid origin: ${origin || "none"}` };
}
