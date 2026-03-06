import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { resolveRootBrand } from "@/lib/root-brand";

type MaybeRecord = Record<string, unknown> | null;

async function safeTable<T = MaybeRecord[]>(
  query: { then: (onfulfilled?: (value: { data: T | null; error: { message: string } | null }) => unknown) => unknown },
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = (await query) as { data: T | null; error: { message: string } | null };
  return { data, error: error?.message || null };
}

export async function getRootRuntimeSnapshot() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const brand = resolveRootBrand(host, headerStore.get("x-root-brand"));
  const sb = getSupabase();

  const [claimsRes, handoffRes, documentsRes] = await Promise.all([
    safeTable(
      sb
        .from("work_claims")
        .select("*")
        .is("released_at", null)
        .order("claimed_at", { ascending: false })
        .limit(25),
    ),
    safeTable(
      sb
        .from("daily_handoffs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    safeTable(
      sb
        .from("document_artifacts")
        .select("id, business_unit, document_type, render_status, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const warnings = [claimsRes.error, handoffRes.error, documentsRes.error].filter(Boolean);

  return {
    brand,
    runtime: {
      host: host || "unknown",
      app_version: process.env.npm_package_version || "0.1.0",
      node_env: process.env.NODE_ENV || "development",
      default_business_unit: brand.defaultBusinessUnit,
      auth_mode: "email_password",
      channels: ["telegram", "imessage"],
      disabled_channels: ["whatsapp"],
      models: {
        primary: "google/gemini-3-flash-preview",
        research: "google/gemini-3.1-pro-preview",
        fallback: "openai/gpt-4.1",
      },
      machine_roles: {
        m2: "authoring + deer",
        m4: "blaze runtime",
        nas: "public apps + root",
      },
    },
    work_claims: claimsRes.data || [],
    handoffs: handoffRes.data || [],
    document_artifacts: documentsRes.data || [],
    warnings,
  };
}
