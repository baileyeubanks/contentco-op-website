import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { logRootAuditEvent } from "@/lib/root-event-log";
import {
  getIntegrityRepairDetail,
  repairIntegrityRecord,
  type IntegrityRecordKind,
} from "@/lib/root-integrity";

interface Props {
  params: Promise<{ kind: string; id: string }>;
}

function normalizeKind(value: string): IntegrityRecordKind | null {
  if (value === "quote" || value === "invoice" || value === "job") return value;
  return null;
}

export async function GET(req: Request, { params }: Props) {
  const resolved = await params;
  const kind = normalizeKind(String(resolved.kind || ""));
  if (!kind) {
    return NextResponse.json({ error: "record_kind_not_supported" }, { status: 404 });
  }

  const result = await getIntegrityRepairDetail(
    supabase,
    kind,
    resolved.id,
    getRootBusinessScopeFromRequest(req),
  );

  if (result.error || !result.detail) {
    return NextResponse.json({ error: result.error || "record_not_found" }, { status: 404 });
  }

  return NextResponse.json(result.detail);
}

export async function PATCH(req: Request, { params }: Props) {
  const resolved = await params;
  const kind = normalizeKind(String(resolved.kind || ""));
  if (!kind) {
    return NextResponse.json({ error: "record_kind_not_supported" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await repairIntegrityRecord(
    supabase,
    kind,
    resolved.id,
    String(body.contact_id || ""),
    getRootBusinessScopeFromRequest(req),
  );

  if (!result.ok) {
    const status = result.error === "record_not_found" || result.error === "contact_not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error || "repair_failed" }, { status });
  }
  const repaired = result.repaired;
  if (!repaired) {
    return NextResponse.json({ error: "repair_failed" }, { status: 500 });
  }

  const requestHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  await logRootAuditEvent({
    type: "root_integrity_repaired",
    host: requestHost,
    businessUnit: repaired.business_unit,
    contactId: repaired.contact_id,
    text: `ROOT integrity repair applied to ${repaired.kind}`,
    payload: {
      repair_kind: repaired.kind,
      record_id: repaired.record_id,
      contact_id: repaired.contact_id,
      business_unit: repaired.business_unit,
    },
  });

  return NextResponse.json(result);
}
