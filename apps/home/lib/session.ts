import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "cco_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 3;

function getSessionSecret() {
  const secret = process.env.CCO_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("missing_cco_session_secret");
  }
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function createInviteSession(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${normalizedEmail}|${exp}`;
  const sig = sign(payload);
  return `${payload}|${sig}`;
}

export function verifyInviteSession(raw: string | undefined | null) {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 3) return null;

  const [email, expRaw, actualSig] = parts;
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  const expectedSig = sign(`${email}|${exp}`);
  const actual = Buffer.from(actualSig, "hex");
  const expected = Buffer.from(expectedSig, "hex");
  if (actual.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(actual, expected)) return null;

  return { email, exp };
}
