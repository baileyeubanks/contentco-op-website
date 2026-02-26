import { cookies } from "next/headers";

export async function requireInviteSession() {
  const store = await cookies();
  const session = store.get("cco_session")?.value;
  if (!session || !session.startsWith("invited:")) {
    return null;
  }
  return session;
}
