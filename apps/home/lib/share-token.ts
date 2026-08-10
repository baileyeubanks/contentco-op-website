import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring share tokens for client-facing quote/invoice links.
 *
 * Format: `<resourceId>.<exp>.<sig>` where `exp` is a unix-seconds expiry and
 * `sig` is base64url(HMAC-SHA256(`<resourceId>.<exp>`, QUOTE_SHARE_SECRET)).
 *
 * Fail-closed: when QUOTE_SHARE_SECRET is unset, signing returns null (share
 * issuance disabled) and verification always rejects.
 */

export const SHARE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; /* 30 days */

function getSecret(): string | null {
  const secret = process.env.QUOTE_SHARE_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signatureFor(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

/** Sign a share token for a resource (quote/invoice id). Null when unconfigured. */
export function signShareToken(
  resourceId: string,
  ttlSeconds: number = SHARE_TOKEN_TTL_SECONDS,
  nowMs: number = Date.now(),
): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${resourceId}.${exp}`;
  return `${payload}.${signatureFor(payload, secret)}`;
}

/** Verify a share token for the given resource id: signed, bound, unexpired. */
export function verifyShareToken(
  token: string | null | undefined,
  resourceId: string,
  nowMs: number = Date.now(),
): boolean {
  const secret = getSecret();
  if (!secret || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenId, expRaw, sig] = parts;
  if (tokenId !== resourceId) return false;

  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp <= Math.floor(nowMs / 1000)) return false;

  const expected = signatureFor(`${tokenId}.${expRaw}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
