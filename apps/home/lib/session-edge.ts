import { getSessionSecretOrNull } from "@/lib/session-shared";

function hexToBytes(value: string) {
  if (!value || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    const byte = Number.parseInt(value.slice(index, index + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[index / 2] = byte;
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

async function sign(payload: string) {
  const secret = getSessionSecretOrNull();
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyInviteSessionEdge(raw: string | undefined | null) {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 3) return null;

  const [email, expRaw, actualSig] = parts;
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  const expectedSig = await sign(`${email}|${exp}`);
  if (!expectedSig) return null;
  const actual = hexToBytes(actualSig);
  const expected = hexToBytes(expectedSig);
  if (!actual || !expected) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  return { email, exp };
}
