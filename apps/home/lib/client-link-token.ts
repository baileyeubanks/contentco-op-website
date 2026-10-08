import { createHmac, timingSafeEqual } from "node:crypto";
import { constants, openSync, fstatSync, readFileSync, closeSync } from "node:fs";
import { NextResponse } from "next/server";

export type ClientLinkType = "quote" | "estimate" | "invoice" | "portal-row";
const wireTypes = { quote: "q", estimate: "e", invoice: "i", "portal-row": "p" } as const;
export const MAX_TTL = 30 * 24 * 60 * 60;
export const PORTAL_LINK_TTL = 7 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /^cl1\.([a-z0-9]{1,8})\.([qeip])\.([1-9][0-9]{9,10})\.([A-Za-z0-9_-]{43})$/;
type Key = { kid: string; bytes: Buffer };
let keyring: Key[] | undefined;
let keyReason = "client_link_key_file_missing";

// Cached once per process. Rotation requires a restart; the first line signs,
// all lines verify. Only the path is configured in the environment.
function loadKeys(): Key[] {
  if (keyring) return keyring;
  keyring = [];
  const path = process.env.CCO_CLIENT_LINK_KEY_FILE;
  if (!path) return keyring;
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 ||
        typeof process.getuid !== "function" || stat.uid !== process.getuid()) {
      keyReason = "client_link_key_file_insecure";
      return keyring;
    }
    if (stat.size > 8192) { keyReason = "client_link_key_file_invalid"; return keyring; }
    const lines = readFileSync(fd, "utf8").trim().split(/\r?\n/);
    const parsed: Key[] = [];
    for (const line of lines) {
      const match = /^([a-z0-9]{1,8}) ([0-9a-fA-F]{64})$/.exec(line);
      if (!match || parsed.some(key => key.kid === match[1])) {
        keyReason = "client_link_key_file_invalid";
        return keyring;
      }
      parsed.push({ kid: match[1], bytes: Buffer.from(match[2], "hex") });
    }
    keyring = parsed;
    keyReason = "client_link_key_file_ok";
  } catch {
    keyReason = "client_link_key_file_unreadable";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return keyring;
}
export function clientLinkKeyStatus(): string { loadKeys(); return keyReason; }
function mac(key: Key, typ: string, id: string, exp: string): Buffer {
  return createHmac("sha256", key.bytes)
    .update(`cco-client-link:v1\n${key.kid}\n${typ}\n${id}\n${exp}`).digest();
}
export function signClientLink(
  typ: ClientLinkType, id: string, options: { ttl?: number; now?: number } = {},
): string | null {
  const ttl = options.ttl ?? MAX_TTL;
  if (!UUID.test(id) || !wireTypes[typ] || !Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL) return null;
  const key = loadKeys()[0];
  if (!key) return null;
  const exp = String(Math.floor((options.now ?? Date.now()) / 1000) + ttl);
  const wire = wireTypes[typ];
  return `cl1.${key.kid}.${wire}.${exp}.${mac(key, wire, id, exp).toString("base64url")}`;
}
export function verifyClientLink(
  token: unknown, typ: ClientLinkType, id: string, now = Date.now(),
): boolean {
  if (typeof token !== "string" || token.length > 128 || !UUID.test(id)) return false;
  const match = TOKEN.exec(token);
  if (!match || match[2] !== wireTypes[typ]) return false;
  const [, kid, wire, expRaw, sig] = match;
  const key = loadKeys().find(key => key.kid === kid);
  if (!key) return false;
  const seconds = Math.floor(now / 1000), exp = Number(expRaw);
  if (!(seconds < exp) || exp - seconds > MAX_TTL) return false;
  const a = Buffer.from(sig, "base64url"), b = mac(key, wire, id, expRaw);
  if (a.toString("base64url") !== sig) return false;
  return a.length === b.length && timingSafeEqual(a, b);
}
export function clientLinkNotFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
export function readClientLink(req: Request): string | null {
  const url = new URL(req.url);
  return req.headers.get("x-client-link") || url.searchParams.get("t");
}
export function buildClientLinkUrl(
  typ: ClientLinkType, id: string,
  options: { ttl?: number; now?: number; origin?: string; surface?: "share" | "client"; token?: string } = {},
): string | null {
  const token = options.token ?? signClientLink(typ, id, options);
  if (!token || !verifyClientLink(token, typ, id, options.now)) return null;
  const origin = options.origin ?? "https://contentco-op.com";
  try {
    const base = new URL(origin);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    const surface = options.surface ?? "share";
    const routeType = typ === "portal-row" ? "portal" : typ;
    const url = new URL(`/${surface}/${routeType}/${id}`, base.origin);
    url.searchParams.set("t", token);
    return url.toString();
  } catch { return null; }
}
