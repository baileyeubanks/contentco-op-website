import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const KNOWN_DEVICE_COOKIE = "__Host-cco_known_device";
export const KNOWN_DEVICE_TTL_SECONDS = 30 * 24 * 60 * 60;

function accountHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function signature(payload: string) {
  const secret = process.env.CCO_SESSION_SECRET?.trim();
  if (!secret) throw new Error("missing_cco_session_secret");
  // Separate this proof of a previous login from every authentication token.
  return createHmac("sha256", secret).update(`cco-known-device-v1:${payload}`).digest("hex");
}

export function createKnownDevice(email: string): string {
  const expires = Math.floor(Date.now() / 1000) + KNOWN_DEVICE_TTL_SECONDS;
  const payload = `${accountHash(email)}.${expires}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function isKnownDevice(req: Request, email: string): boolean {
  const raw = req.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${KNOWN_DEVICE_COOKIE}=`))?.slice(KNOWN_DEVICE_COOKIE.length + 1);
  if (!raw || raw.length > 256) return false;
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  const [account, expiresRaw, nonce, actual] = parts;
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{32}$/.test(nonce)) return false;
  try {
    const expected = signature(`${account}.${expiresRaw}.${nonce}`);
    if (!timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))) return false;
    const expires = Number(expiresRaw);
    const now = Math.floor(Date.now() / 1000);
    return account === accountHash(email) && Number.isSafeInteger(expires)
      && expires > now && expires <= now + KNOWN_DEVICE_TTL_SECONDS;
  } catch {
    return false;
  }
}
