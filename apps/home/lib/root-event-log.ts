import { supabase } from "@/lib/supabase";
import { resolveRootAuthorityForHost } from "@/lib/root-auth";
import { getEventCategory, type RootEventType } from "@/lib/root-event-taxonomy";

type EventObjectType =
  | "contact"
  | "company"
  | "opportunity"
  | "invoice"
  | "payment"
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
    const { data, error } = await supabase.from("events").insert({
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
      return { ok: false as const, error: error.message, eventId: null };
    }

    return { ok: true as const, eventId: data?.id || null };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "unknown_error",
      eventId: null,
    };
  }
}
