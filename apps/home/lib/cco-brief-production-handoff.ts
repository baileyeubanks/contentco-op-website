import type { SupabaseClient } from "@supabase/supabase-js";
import { getCcoOsDatabase } from "@/lib/cco-public-intake";
import { handoffEstimateToCoVideoPro } from "@/lib/cvp-handoff";

type ClientLike = Pick<SupabaseClient, "from">;
type ProjectLink = { id: string; title: string; schema: "co_production" };

/** Resolve an existing commercial relationship; never generate or approve scope here. */
export async function handoffBriefToProduction(
  requestedBriefId: string,
  businessUnit = "CC",
  deps?: { sb?: ClientLike; cvpSb?: ClientLike; env?: Record<string, string | undefined> },
) {
  let briefId: string | null = null;
  const fail = (error: string, action: string, retryable = false, stage = "commercial_link") => ({
    project: null as ProjectLink | null, briefId, error, action, retryable, stage, partial: false, replayed: false,
  });
  if (businessUnit !== "CC") return fail("brief_scope_mismatch", "Choose a CCO brief.");
  try {
    let sb = deps?.sb;
    if (!sb) {
      const binding = getCcoOsDatabase(deps?.env || process.env);
      if (!binding.ok) return fail(binding.error, "Restore the existing CCO database binding.");
      sb = binding.db as unknown as ClientLike;
    }
    const saved = await sb.from("creative_briefs").select("id, company_account_id, normalized_scope_metadata")
      .eq("id", requestedBriefId).maybeSingle();
    if (saved.error) return fail("brief_lookup_failed", "Retry loading the saved brief.", true);
    if (!saved.data?.id) return fail("brief_not_found", "Choose an existing brief.");
    briefId = String(saved.data.id);
    if (saved.data.company_account_id !== "content-co-op") return fail("brief_scope_mismatch", "Choose a CCO brief.");
    const linked = await sb.from("estimates").select("id, brief_id, business_unit, internal_status, client_status, active_version_id, superseded_by_estimate_id")
      .eq("brief_id", briefId).eq("business_unit", "CC");
    if (linked.error) return fail("estimate_link_lookup_failed", "Retry loading this brief's commercial estimates.", true);
    const eligible = (linked.data || []).filter((row) => !row.superseded_by_estimate_id && row.internal_status === "approved" &&
      row.client_status === "approved" && row.active_version_id);
    if (!eligible.length) return fail("approved_estimate_required", "Prepare an estimate for this brief, obtain approval, and freeze its commercial version before opening production work.");
    if (eligible.length !== 1) return fail("brief_estimate_ambiguous", "More than one approved estimate is linked to this brief. Reconcile the current commercial version before continuing.");
    // The normalized scope link is a corroborating receipt, never a substitute
    // for estimates.brief_id or permission to choose among multiple approvals.
    const hinted = saved.data.normalized_scope_metadata?.estimate_id;
    if (hinted && hinted !== eligible[0].id) return fail("brief_estimate_link_conflict", "The brief and approved estimate links disagree. Reconcile them before continuing.");
    const result = await handoffEstimateToCoVideoPro({ estimateId: eligible[0].id, briefId }, { ...deps, sb });
    const project: ProjectLink | null = result.receipt ? {
      id: result.receipt.cvpProjectId, title: String(result.receipt.commercialRef.estimate_number || "Production project"), schema: "co_production",
    } : result.progress.cvpProjectId ? { id: result.progress.cvpProjectId, title: "Saved production project", schema: "co_production" } : null;
    return { ...result, project, briefId, replayed: result.receipt?.replayed || false };
  } catch {
    return fail("brief_handoff_temporarily_unavailable", "Retry this brief to resume any saved handoff.", true, "request");
  }
}
