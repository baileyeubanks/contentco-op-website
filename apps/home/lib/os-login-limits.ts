import { createHash } from "node:crypto";
import { isIP } from "node:net";

const WINDOW_MS = 15 * 60_000;
const MAX_REQUESTERS = 10_000;
type Budget = { until: number; count: number; emails: Map<string, number> };
const requesters = new Map<string, Budget>();

export function loginClientBucket(ip: string): string {
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return "unknown";
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const words = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  const parts = words.map(word => parseInt(word, 16));
  if (parts.slice(0, 5).every(n => n === 0) && parts[5] === 65535) {
    return [parts[6] >> 8, parts[6] & 255, parts[7] >> 8, parts[7] & 255].join(".");
  }
  return parts.slice(0, 4).map(n => n.toString(16)).join(":") + "::/64";
}

// Both limits belong to the requester. Never create a target-email-only lockout.
// Counts are reserved synchronously before async credential verification.
export function allowLoginAttempt(ip: string, email: string): boolean {
  const key = loginClientBucket(ip);
  const now = Date.now();
  for (const [key, entry] of requesters) if (entry.until <= now) requesters.delete(key);
  let entry = requesters.get(key);
  if (!entry) {
    // Bound memory without a global lockout controlled by unrelated callers.
    if (requesters.size >= MAX_REQUESTERS) requesters.delete(requesters.keys().next().value!);
    entry = { until: now + WINDOW_MS, count: 0, emails: new Map() };
    requesters.set(key, entry);
  }
  if (entry.count >= 20) return false;
  entry.count++;
  const emailKey = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const count = entry.emails.get(emailKey) || 0;
  if (count >= 5) return false;
  entry.emails.set(emailKey, count + 1);
  return true;
}
