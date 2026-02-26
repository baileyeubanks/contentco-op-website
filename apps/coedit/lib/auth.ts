import { createSupabaseAuth } from "./supabase-auth";

/** Require authenticated Supabase user — returns null if not signed in */
export async function requireAuth() {
  const supabase = await createSupabaseAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return user;
}
