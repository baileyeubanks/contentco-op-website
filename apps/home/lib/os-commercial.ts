import { SupabaseClient } from "@supabase/supabase-js";

type RootQuoteIdentityInput = {
  contact_id?: string | null;
  business_id?: string | null;
  business_unit?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  service_address?: string | null;
  payload?: Record<string, unknown> | null;
};

type RootCommercialIdentity = {
  contactId: string | null;
  businessId: string | null;
  businessUnit: "ACS" | "CC";
  payload: Record<string, unknown> | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
};

function normalizeBusinessUnit(value?: string | null): "ACS" | "CC" {
  return String(value || "").trim().toUpperCase() === "CC" ? "CC" : "ACS";
}

function clean(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeEmail(value?: string | null) {
  const email = clean(value);
  return email ? email.toLowerCase() : null;
}

function normalizePhone(value?: string | null) {
  const phone = clean(value);
  return phone ? phone.replace(/[^\d+]/g, "") : null;
}

function mergeBuyerIntoPayload(
  payload: Record<string, unknown> | null | undefined,
  input: {
    businessUnit: "ACS" | "CC";
    clientName: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceAddress: string | null;
  },
) {
  const nextPayload = payload && typeof payload === "object" ? { ...payload } : {};
  const currentBuyer = nextPayload.buyer && typeof nextPayload.buyer === "object"
    ? { ...(nextPayload.buyer as Record<string, unknown>) }
    : {};

  nextPayload.buyer = {
    ...currentBuyer,
    name: input.clientName || currentBuyer.name || null,
    email: input.clientEmail || currentBuyer.email || null,
    phone: input.clientPhone || currentBuyer.phone || null,
    address: input.serviceAddress || currentBuyer.address || null,
  };

  nextPayload.source_context = {
    ...(nextPayload.source_context && typeof nextPayload.source_context === "object"
      ? (nextPayload.source_context as Record<string, unknown>)
      : {}),
    business_unit: input.businessUnit,
    origin: "root_operator_quote",
  };

  return nextPayload;
}

async function resolveBusinessId(
  supabase: SupabaseClient,
  businessId?: string | null,
  businessUnit?: string | null,
) {
  if (clean(businessId)) {
    return clean(businessId);
  }

  const unit = normalizeBusinessUnit(businessUnit);
  const { data } = await supabase
    .from("businesses")
    .select("id, code")
    .eq("code", unit)
    .maybeSingle();

  return clean(data?.id);
}

async function findExistingContact(
  supabase: SupabaseClient,
  clientEmail: string | null,
  clientPhone: string | null,
) {
  if (clientEmail) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, name, email, phone, company")
      .eq("email", clientEmail)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (clientPhone) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, name, email, phone, company")
      .eq("phone", clientPhone)
      .maybeSingle();
    if (data?.id) return data;
  }

  return null;
}

async function ensureContactMembership(
  supabase: SupabaseClient,
  contactId: string | null,
  businessId: string | null,
) {
  if (!contactId || !businessId) return;

  await supabase
    .from("contact_business_map")
    .upsert([{ contact_id: contactId, business_id: businessId }], {
      onConflict: "contact_id,business_id",
    });
}

export async function ensureRootCommercialIdentity(
  supabase: SupabaseClient,
  input: RootQuoteIdentityInput,
): Promise<RootCommercialIdentity> {
  const businessUnit = normalizeBusinessUnit(input.business_unit);
  const businessId = await resolveBusinessId(supabase, input.business_id, businessUnit);
  const clientName = clean(input.client_name);
  const clientEmail = normalizeEmail(input.client_email);
  const clientPhone = normalizePhone(input.client_phone);
  const serviceAddress = clean(input.service_address);

  let contactId = clean(input.contact_id);

  if (!contactId && (clientEmail || clientPhone)) {
    const existingContact = await findExistingContact(supabase, clientEmail, clientPhone);
    if (existingContact?.id) {
      contactId = String(existingContact.id);

      await supabase
        .from("contacts")
        .update({
          full_name: clientName || existingContact.full_name || null,
          name: clientName || existingContact.name || null,
          email: clientEmail || existingContact.email || null,
          phone: clientPhone || existingContact.phone || null,
        })
        .eq("id", contactId);
    }
  }

  if (!contactId && (clientName || clientEmail || clientPhone)) {
    const { data } = await supabase
      .from("contacts")
      .insert({
        full_name: clientName,
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        status: "active",
      })
      .select("id")
      .single();
    contactId = clean(data?.id);
  }

  await ensureContactMembership(supabase, contactId, businessId);

  return {
    contactId,
    businessId,
    businessUnit,
    payload: mergeBuyerIntoPayload(input.payload, {
      businessUnit,
      clientName,
      clientEmail,
      clientPhone,
      serviceAddress,
    }),
    clientName,
    clientEmail,
    clientPhone,
  };
}

export function hasCompleteRootCommercialIdentity(identity: RootCommercialIdentity) {
  return Boolean(identity.contactId && identity.businessId && identity.businessUnit);
}
