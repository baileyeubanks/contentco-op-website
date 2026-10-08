import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { renderClientDocumentPdf } from "@/lib/client-document";
import { renderDocumentPdfBuffer } from "@/lib/os-document-artifacts";
import {
  buildEstimateVersionArtifactPayload,
  type EstimateVersionSnapshot,
} from "@/lib/os-estimate-versions";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  /* Public share pages link this route with a signed share token (?t=);
     everyone else needs the internal policy. */
  const limited = clientLinkRateLimit(req, "os/quotes/pdf");
  if (limited) return limited;
  const shareToken = readClientLink(req);
  if (!verifyClientLink(shareToken, "quote", id)) {
    if (shareToken) return clientLinkNotFound();
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.quotes.pdf",
        accessLevel: "internal",
        sessionPolicies: ["supabase_user", "operator_invite"],
        requiredPermissions: ["quote_read"],
        tenantBoundary: "internal_workspace",
      }),
    );
    if (!access.ok) return clientLinkNotFound();
  }

  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id,quote_number,client_name,business_unit,payload")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (error || !quote || quote.business_unit !== "CC") return clientLinkNotFound();

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return clientLinkNotFound();
  }

  const filename = `${quote.quote_number || `quote-${id.slice(0, 8)}`}-${String(quote.client_name || "draft").replace(/\s+/g, "_")}.pdf`;

  // Frozen-version path: when the bridged estimate has been sent, render from
  // the immutable snapshot (task 2.5) instead of shelling out to the
  // live-row renderer. Legacy quotes use the CC-scoped local artifact helper.
  // Bridge note: the estimate↔quote link is dual — quotes.payload.estimate_id
  // (used here) and estimates.legacy_quote_id (used by the pay/edit guards).
  // Both are written together at estimate creation; keep them intact.
  const estimateId = asRecord(quote.payload)?.estimate_id ? String(asRecord(quote.payload)!.estimate_id) : null;
  if (estimateId) {
    const { data: estimate } = await sb
      .from("estimates")
      .select("id, active_version_id, business_unit")
      .eq("id", estimateId)
      .eq("business_unit", "CC")
      .maybeSingle();
    if (!estimate || estimate.business_unit !== "CC") return clientLinkNotFound();
    if (estimate.active_version_id) {
      const { data: versionRow } = await sb
        .from("estimate_versions")
        .select("snapshot, version")
        .eq("id", estimate.active_version_id)
        .eq("estimate_id", estimateId)
        .maybeSingle();
      if (versionRow?.snapshot) {
        const snapshot = versionRow.snapshot as EstimateVersionSnapshot;
        if (snapshot.estimate?.business_unit !== "CC") return clientLinkNotFound();
        const payload = buildEstimateVersionArtifactPayload(versionRow.snapshot as EstimateVersionSnapshot);
        const pdf = await renderDocumentPdfBuffer(payload);
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${filename}"`,
            "cache-control": "no-store",
            "x-estimate-version": String(versionRow.version ?? ""),
          },
        });
      }
    }
  }

  // Legacy quote: render from a fresh, explicitly scoped CC-only row.
  const pdf = await renderClientDocumentPdf("quote", id).catch(() => null);
  if (!pdf) return clientLinkNotFound();
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
