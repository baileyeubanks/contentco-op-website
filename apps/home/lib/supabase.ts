import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Server-side Supabase client — lazy-initialized, uses service role key (bypasses RLS). */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? "";
    _client = createClient(url, serviceKey);
  }
  return _client;
}

/** Convenience alias — lazy proxy so module can be imported at build time without env vars. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  },
});
