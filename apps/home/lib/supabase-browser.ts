import { createBrowserClient } from "@supabase/ssr";
import { getRequiredPublicSupabaseConfig } from "@/lib/runtime-config";

/**
 * Browser-side Supabase client — uses anon key, manages auth session via cookies.
 * Use in client components ("use client").
 */
export function createClient() {
  const config = getRequiredPublicSupabaseConfig();
  return createBrowserClient(
    config.url,
    config.anonKey,
  );
}
