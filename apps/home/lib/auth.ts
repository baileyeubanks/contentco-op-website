import { cookies } from "next/headers";
import { getSessionCookieName, verifyInviteSession } from "@/lib/session";

export async function requireInviteSession() {
  const store = await cookies();
  const session = store.get(getSessionCookieName())?.value;
  const claims = verifyInviteSession(session);
  if (!claims) {
    return null;
  }
  return claims;
}
