/**
 * Simple in-memory rate limiter for Next.js API routes.
 * For production scale, replace with Redis-backed limiter.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function getKey(identifier: string, windowMs: number): string {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  return `${identifier}:${windowStart}`;
}

export function rateLimit(
  identifier: string,
  options: { max: number; windowMs: number } = { max: 60, windowMs: 60000 }
): { success: boolean; limit: number; remaining: number; resetAt: number } {
  const key = getKey(identifier, options.windowMs);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, limit: options.max, remaining: options.max - 1, resetAt: now + options.windowMs };
  }

  if (entry.count >= options.max) {
    return { success: false, limit: options.max, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, limit: options.max, remaining: options.max - entry.count, resetAt: entry.resetAt };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
