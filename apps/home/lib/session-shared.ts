export const SESSION_COOKIE_NAME = "cco_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 3;

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function getSessionSecretOrNull() {
  return process.env.CCO_SESSION_SECRET?.trim() || null;
}

export function hasSessionSecret() {
  return Boolean(getSessionSecretOrNull());
}

export function getSessionSecret() {
  const secret = getSessionSecretOrNull();
  if (!secret) {
    throw new Error("missing_cco_session_secret");
  }
  return secret;
}

export function normalizeSessionEmail(value: string) {
  return value.trim().toLowerCase();
}
