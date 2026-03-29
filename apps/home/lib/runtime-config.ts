type PublicSupabaseConfig = {
  url: string | null;
  anonKey: string | null;
  missing: string[];
  isConfigured: boolean;
};

type SessionConfig = {
  secret: string | null;
  missing: string[];
  isConfigured: boolean;
};

const FALLBACK_PUBLIC_SUPABASE_URL = "https://briokwdoonawhxisbydy.supabase.co";
const FALLBACK_PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9rd2Rvb25hd2h4aXNieWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTY3NjIsImV4cCI6MjA4NzEzMjc2Mn0.FO7zSCy_rPiKIkskWLFJIVq5-BPdXeBVYaBF4M5x2_M";

function readEnv(key: string) {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolvePublicSupabaseConfig(): PublicSupabaseConfig {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL") || readEnv("SUPABASE_URL") || FALLBACK_PUBLIC_SUPABASE_URL;
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || FALLBACK_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    ...(url ? [] : ["NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL"]),
    ...(anonKey ? [] : ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  ];

  return {
    url,
    anonKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

export function getRequiredPublicSupabaseConfig() {
  const config = resolvePublicSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    throw new Error(`missing_public_supabase_env:${config.missing.join(",")}`);
  }
  return {
    url: config.url,
    anonKey: config.anonKey,
  };
}

export function resolveSessionConfig(): SessionConfig {
  const secret = readEnv("CCO_SESSION_SECRET");
  const missing = secret ? [] : ["CCO_SESSION_SECRET"];
  return {
    secret,
    missing,
    isConfigured: missing.length === 0,
  };
}
