import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { readCanonicalQuotePdf } from "@/lib/os-document-authority";
import { renderDocumentPdfBuffer } from "@/lib/os-document-artifacts";
import {
  buildEstimateVersionArtifactPayload,
  type EstimateVersionSnapshot,
} from "@/lib/os-estimate-versions";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id,quote_number,client_name,business_unit,payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const filename = `${quote.quote_number || `quote-${id.slice(0, 8)}`}-${String(quote.client_name || "draft").replace(/\s+/g, "_")}.pdf`;

  // Frozen-version path: when the bridged estimate has been sent, render from
  // the immutable snapshot (task 2.5) instead of shelling out to the
  // machine-local live-row renderer. The canonical script
  // (os-document-authority.ts) reads live DB rows, so it stays the fallback
  // for legacy quotes that have no frozen version.
  const estimateId = asRecord(quote.payload)?.estimate_id ? String(asRecord(quote.payload)!.estimate_id) : null;
  if (estimateId) {
    const { data: estimate } = await sb
      .from("estimates")
      .select("id, active_version_id")
      .eq("id", estimateId)
      .maybeSingle();
    if (estimate?.active_version_id) {
      const { data: versionRow } = await sb
        .from("estimate_versions")
        .select("snapshot, version")
        .eq("id", estimate.active_version_id)
        .maybeSingle();
      if (versionRow?.snapshot) {
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

  // Legacy fallback: quote never bridged/frozen — machine-local live renderer.
  const pdf = await readCanonicalQuotePdf(id);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
