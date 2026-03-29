import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRequiredPublicSupabaseConfig } from "@/lib/runtime-config";

/**
 * Server-side Supabase client — reads auth session from cookies.
 * Use in server components, route handlers, and server actions.
 * This uses the ANON key (respects RLS) — for service-role access, use lib/supabase.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const config = getRequiredPublicSupabaseConfig();

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can fail in Server Components (read-only cookies).
            // That's fine — middleware handles refresh.
          }
        },
      },
    },
  );
}
