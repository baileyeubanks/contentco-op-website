import { randomBytes } from "node:crypto";
export const MIN_PORTAL_TOKEN_LENGTH = 32;
export function isAcceptablePortalToken(token: unknown): token is string {
  if (typeof token !== "string" || token.length < MIN_PORTAL_TOKEN_LENGTH || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return false;
  const counts = new Map<string, number>();
  for (const char of token) counts.set(char, (counts.get(char) ?? 0) + 1);
  return counts.size >= 10 && Math.max(...counts.values()) <= token.length * 0.25;
}
export function generatePortalToken(): string {
  let token: string;
  do { token = randomBytes(32).toString("base64url"); } while (!isAcceptablePortalToken(token));
  return token;
}
