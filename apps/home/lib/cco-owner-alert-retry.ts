import type { SupabaseClient } from "@supabase/supabase-js";
import { getCcoOsDatabase } from "@/lib/cco-public-intake";
import { CCO_OWNER_LEAD_ALERT_TEMPLATE, notifyCcoOwnerOfStoredLead, type CcoOwnerLeadAlertDeps } from "@/lib/cco-owner-lead-alert";

/** Existing invoice-reminder cron calls this; no independent schedule or direct send rail. */
export async function retryCcoOwnerLeadAlerts(deps: CcoOwnerLeadAlertDeps = {}) {
  const summary = { evaluated: 0, delivered: 0, pending: 0, gave_up: 0, errors: 0 };
  const binding = deps.db ? { ok: true as const, db: deps.db } : getCcoOsDatabase(deps.env);
  if (!binding.ok) return { ...summary, errors: 1, reason: "notification_log_unavailable" };
  const db = binding.db;
  const now = deps.now || new Date();
  try {
    // Non-idempotent email outcomes stay unknown: never blindly repeat an ambiguous Gmail handoff.
    // Text can be reconciled/replayed safely because its outbox key never changes.
    const rows = await (db as unknown as SupabaseClient).from("notification_log")
      .select("contact_id,metadata")
      .eq("template_key", CCO_OWNER_LEAD_ALERT_TEMPLATE).eq("audience", "internal")
      .or("metadata->>retry_exhausted.is.null,metadata->>retry_exhausted.neq.true")
      .or("status.eq.failed,and(metadata->>transport.eq.cco_text_outbox,status.in.(queued,sending,unknown))")
      .or(`metadata->>next_retry_at.is.null,metadata->>next_retry_at.lte.${now.toISOString()}`)
      .order("metadata->>next_retry_at", { ascending: true, nullsFirst: true }).limit(50);
    if (rows.error) throw new Error("notification_log_unavailable");
    const seen = new Set<string>();
    for (const row of rows.data || []) {
      if (summary.evaluated >= 25) break;
      const leadId = row.contact_id;
      const briefId = typeof row.metadata?.brief_id === "string" ? row.metadata.brief_id : undefined;
      const key = briefId || leadId;
      if (typeof leadId !== "string" || !leadId || seen.has(key)) continue;
      seen.add(key);
      summary.evaluated++;
      // Link back to stored data rather than duplicating public free text in retry metadata.
      const result = await notifyCcoOwnerOfStoredLead({ leadId, briefId, name: "Saved lead" }, { ...deps, db, now });
      if (result.email.delivered || result.sms.delivered) summary.delivered++;
      if (result.email.status === "gave_up" || result.sms.status === "gave_up") summary.gave_up++;
      if ([result.email, result.sms].some(channel => !channel.delivered && channel.status !== "gave_up")) summary.pending++;
    }
  } catch {
    summary.errors++;
    console.warn("[cco-owner-alert-retry] notification_log_unavailable");
  }
  return summary;
}
