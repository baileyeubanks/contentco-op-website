import { supabase } from "@/lib/supabase";
import { resolveRootAuthorityForHost } from "@/lib/os-auth";
import { getEventCategory, type RootEventType } from "@/lib/os-event-taxonomy";
import { ccoRecordId } from "@/lib/cco-record-id";

type EventObjectType =
  | "contact"
  | "company"
  | "brief"
  | "opportunity"
  | "estimate"
  | "approval"
  | "invoice"
  | "payment"
  | "workflow"
  | "project"
  | "deliverable"
  | "campaign"
  | "job"
  | "automation";

type RootAuditPayload = {
  type: string;
  host?: string | null;
  email?: string | null;
  businessId?: string | null;
  businessUnit?: "ACS" | "CC" | null;
  contactId?: string | null;
  text?: string | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type TypedEventPayload = {
  /** Stable server-owned key for repeatable multi-step operations. */
  idempotencyKey?: string;
  type: RootEventType;
  objectType: EventObjectType;
  objectId: string;
  businessUnit?: "ACS" | "CC" | null;
  contactId?: string | null;
  text?: string | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

function normalizeBusinessUnit(host: string | null | undefined, explicit: "ACS" | "CC" | null | undefined) {
  if (explicit === "ACS" || explicit === "CC") return explicit;
  return resolveRootAuthorityForHost(host || undefined) === "acs" ? "ACS" : "CC";
}

export async function logRootAuditEvent(input: RootAuditPayload) {
  const host = String(input.host || "").trim() || null;
  const businessUnit = normalizeBusinessUnit(host, input.businessUnit);
  const payload = {
    ...(input.payload || {}),
    audit_scope: "root",
    host,
    email: input.email || null,
    business_unit: businessUnit,
  };

  try {
    await supabase.from("events").insert({
      type: input.type,
      business_id: input.businessId || null,
      business_unit: businessUnit,
      contact_id: input.contactId || null,
      text: input.text || null,
      payload,
      metadata: input.metadata || null,
      channel: "root",
      direction: "internal",
      object_type: null,
      object_id: null,
      event_category: getEventCategory(input.type) || null,
    });
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Emit a typed event with full object binding.
 * Use this for all new ontology events — populates object_type, object_id, and event_category.
 */
export async function emitTypedEvent(input: TypedEventPayload) {
  const businessUnit = input.businessUnit || "CC";
  const category = getEventCategory(input.type);

  try {
    // Reuse both legacy receipts (random IDs) and current deterministic ones.
    // The primary key below arbitrates two concurrent first-time emissions.
    const findExisting = () => supabase.from("events").select("id")
      .eq("business_unit", businessUnit).eq("type", input.type)
      .eq("object_type", input.objectType).eq("object_id", input.objectId)
      .limit(1).maybeSingle();
    if (input.idempotencyKey) {
      const existing = await findExisting();
      if (existing.error) return { ok: false as const, error: existing.error.message, eventId: null };
      if (existing.data?.id) return { ok: true as const, eventId: existing.data.id };
    }
    const { data, error } = await supabase.from("events").insert({
      ...(input.idempotencyKey ? { id: ccoRecordId("typed-event", `${businessUnit}:${input.idempotencyKey}`) } : {}),
      type: input.type,
      business_unit: businessUnit,
      contact_id: input.contactId || null,
      text: input.text || null,
      payload: {
        ...(input.payload || {}),
        audit_scope: "root",
        business_unit: businessUnit,
      },
      metadata: input.metadata || null,
      channel: "root",
      direction: "internal",
      object_type: input.objectType,
      object_id: input.objectId,
      event_category: category,
    }).select("id").single();

    if (error) {
      if (input.idempotencyKey && error.code === "23505") {
        const winner = await findExisting();
        if (!winner.error && winner.data?.id) return { ok: true as const, eventId: winner.data.id };
      }
      return { ok: false as const, error: error.message, eventId: null };
    }

    return data?.id
      ? { ok: true as const, eventId: data.id }
      : { ok: false as const, error: "event_receipt_missing", eventId: null };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "unknown_error",
      eventId: null,
    };
  }
}
