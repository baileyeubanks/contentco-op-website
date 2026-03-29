import type { SupabaseClient } from "@supabase/supabase-js";
import type { RootBusinessScope } from "@/lib/root-request-scope";

export type IntegrityRecordKind = "quote" | "invoice" | "job";

type ContactCandidateRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string | null;
};

type RepairContext = {
  kind: IntegrityRecordKind;
  record: Record<string, unknown>;
  linkedQuote: Record<string, unknown> | null;
  businessId: string | null;
  businessUnit: "ACS" | "CC" | null;
  searchProfile: {
    label: string;
    clientName: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
    company: string | null;
  };
};

function clean(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeEmail(value: unknown) {
  const email = clean(value);
  return email ? email.toLowerCase() : null;
}

function normalizePhone(value: unknown) {
  const phone = clean(value);
  return phone ? phone.replace(/[^\d+]/g, "") : null;
}

function normalizeBusinessUnit(value: unknown): "ACS" | "CC" | null {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ACS") return "ACS";
  if (normalized === "CC") return "CC";
  return null;
}

function normalizeBuyerFromPayload(payload: Record<string, unknown> | null | undefined) {
  const buyer = (payload as { buyer?: Record<string, unknown>; doc?: Record<string, unknown> } | null)?.buyer;
  const docBuyer = (payload as { doc?: { buyer?: Record<string, unknown> } } | null)?.doc?.buyer;
  const source = buyer || docBuyer || {};
  return {
    name: clean(source.name),
    email: normalizeEmail(source.email),
    phone: normalizePhone(source.phone),
    company: clean(source.company),
  };
}

function displayName(contact: ContactCandidateRow) {
  return contact.full_name || contact.name || "Unnamed Contact";
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, " ").trim();
}

async function resolveBusinessCodeById(supabase: SupabaseClient, businessId: string | null) {
  if (!businessId) return null;
  const { data } = await supabase
    .from("businesses")
    .select("id,code,name")
    .eq("id", businessId)
    .maybeSingle();
  return normalizeBusinessUnit(data?.code || data?.name || null);
}

async function getLinkedQuote(supabase: SupabaseClient, quoteId: string | null) {
  if (!quoteId) return null;
  const { data } = await supabase
    .from("quotes")
    .select("id,contact_id,business_id,business_unit,client_name,client_email,client_phone,payload,service_address,quote_number")
    .eq("id", quoteId)
    .maybeSingle();
  return data || null;
}

async function buildRepairContext(
  supabase: SupabaseClient,
  kind: IntegrityRecordKind,
  id: string,
  scope: RootBusinessScope,
): Promise<{ context: RepairContext | null; error: string | null }> {
  const recordId = clean(id);
  if (!recordId) return { context: null, error: "record_not_found" };

  let record: Record<string, unknown> | null = null;
  if (kind === "quote") {
    const { data } = await supabase
      .from("quotes")
      .select("id,contact_id,business_id,business_unit,status,created_at,quote_number,client_name,client_email,client_phone,payload,service_address")
      .eq("id", recordId)
      .maybeSingle();
    record = data || null;
  } else if (kind === "invoice") {
    const { data } = await supabase
      .from("invoices")
      .select("id,contact_id,business_id,business_unit,status,created_at,invoice_number,quote_id,customer_id,total,amount,notes")
      .eq("id", recordId)
      .maybeSingle();
    record = data || null;
  } else {
    const { data } = await supabase
      .from("jobs")
      .select("id,contact_id,business_id,business_unit,status,created_at,scheduled_date,scheduled_start,title,description,quote_id,notes")
      .eq("id", recordId)
      .maybeSingle();
    record = data || null;
  }

  if (!record) return { context: null, error: "record_not_found" };

  const linkedQuote = await getLinkedQuote(supabase, clean(record.quote_id));
  const businessId = clean(record.business_id) || clean(linkedQuote?.business_id);
  const businessUnit =
    normalizeBusinessUnit(record.business_unit) ||
    normalizeBusinessUnit(linkedQuote?.business_unit) ||
    await resolveBusinessCodeById(supabase, businessId);

  if (scope && businessUnit && businessUnit !== scope) {
    return { context: null, error: "record_not_found" };
  }

  const buyer = normalizeBuyerFromPayload((record.payload as Record<string, unknown> | null) || (linkedQuote?.payload as Record<string, unknown> | null) || null);
  const searchProfile = {
    label:
      clean(record.quote_number) ||
      clean(record.invoice_number) ||
      clean(record.title) ||
      clean(record.client_name) ||
      clean(linkedQuote?.client_name) ||
      `record-${recordId.slice(0, 8)}`,
    clientName: clean(record.client_name) || clean(linkedQuote?.client_name) || buyer.name,
    clientEmail: normalizeEmail(record.client_email) || normalizeEmail(linkedQuote?.client_email) || buyer.email,
    clientPhone: normalizePhone(record.client_phone) || normalizePhone(linkedQuote?.client_phone) || buyer.phone,
    company: buyer.company,
  };

  return {
    context: {
      kind,
      record,
      linkedQuote,
      businessId,
      businessUnit,
      searchProfile,
    },
    error: null,
  };
}

async function hydrateMemberships(
  supabase: SupabaseClient,
  contacts: ContactCandidateRow[],
) {
  const ids = Array.from(new Set(contacts.map((contact) => String(contact.id)).filter(Boolean)));
  if (ids.length === 0) return new Map<string, string[]>();

  const [{ data: businessMap }, { data: businesses }] = await Promise.all([
    supabase.from("contact_business_map").select("contact_id,business_id").in("contact_id", ids),
    supabase.from("businesses").select("id,code,name"),
  ]);

  const businessCodeById = new Map(
    (businesses || []).map((row) => [String(row.id), String(row.code || row.name || "").trim().toUpperCase()]),
  );
  const memberships = new Map<string, Set<string>>();
  for (const row of businessMap || []) {
    const contactId = String(row.contact_id || "");
    const code = businessCodeById.get(String(row.business_id || ""));
    if (!contactId || !code) continue;
    const set = memberships.get(contactId) || new Set<string>();
    set.add(code);
    memberships.set(contactId, set);
  }
  return new Map(Array.from(memberships.entries()).map(([contactId, values]) => [contactId, Array.from(values)]));
}

async function searchContactCandidates(supabase: SupabaseClient, context: RepairContext) {
  const candidates = new Map<string, ContactCandidateRow & { score: number; reasons: Set<string> }>();

  const addCandidate = (contact: ContactCandidateRow | null | undefined, score: number, reason: string) => {
    if (!contact?.id) return;
    const existing = candidates.get(String(contact.id));
    if (existing) {
      existing.score = Math.max(existing.score, score);
      existing.reasons.add(reason);
      return;
    }
    candidates.set(String(contact.id), {
      ...contact,
      score,
      reasons: new Set([reason]),
    });
  };

  const linkedQuoteContactId = clean(context.linkedQuote?.contact_id);
  if (linkedQuoteContactId) {
    const { data } = await supabase
      .from("contacts")
      .select("id,full_name,name,email,phone,company,status")
      .eq("id", linkedQuoteContactId)
      .maybeSingle();
    addCandidate(data as ContactCandidateRow | null, 100, "linked quote contact");
  }

  if (context.searchProfile.clientEmail) {
    const { data } = await supabase
      .from("contacts")
      .select("id,full_name,name,email,phone,company,status")
      .eq("email", context.searchProfile.clientEmail);
    for (const row of data || []) addCandidate(row as ContactCandidateRow, 90, "exact email");
  }

  if (context.searchProfile.clientPhone) {
    const { data } = await supabase
      .from("contacts")
      .select("id,full_name,name,email,phone,company,status")
      .eq("phone", context.searchProfile.clientPhone);
    for (const row of data || []) addCandidate(row as ContactCandidateRow, 80, "exact phone");
  }

  if (context.searchProfile.clientName && context.searchProfile.clientName.length >= 3) {
    const query = `%${escapeIlike(context.searchProfile.clientName)}%`;
    const [fullNameRes, nameRes] = await Promise.all([
      supabase.from("contacts").select("id,full_name,name,email,phone,company,status").ilike("full_name", query).limit(8),
      supabase.from("contacts").select("id,full_name,name,email,phone,company,status").ilike("name", query).limit(8),
    ]);
    for (const row of fullNameRes.data || []) addCandidate(row as ContactCandidateRow, 55, "name match");
    for (const row of nameRes.data || []) addCandidate(row as ContactCandidateRow, 50, "alternate name match");
  }

  if (context.searchProfile.company && context.searchProfile.company.length >= 2) {
    const { data } = await supabase
      .from("contacts")
      .select("id,full_name,name,email,phone,company,status")
      .ilike("company", `%${escapeIlike(context.searchProfile.company)}%`)
      .limit(8);
    for (const row of data || []) addCandidate(row as ContactCandidateRow, 35, "company match");
  }

  const hydrated = Array.from(candidates.values());
  const memberships = await hydrateMemberships(supabase, hydrated);

  return hydrated
    .map((candidate) => ({
      id: candidate.id,
      display_name: displayName(candidate),
      email: candidate.email,
      phone: candidate.phone,
      company: candidate.company,
      status: candidate.status,
      business_memberships: memberships.get(String(candidate.id)) || [],
      score: candidate.score,
      reasons: Array.from(candidate.reasons),
    }))
    .sort((a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name))
    .slice(0, 8);
}

export async function getIntegrityRepairDetail(
  supabase: SupabaseClient,
  kind: IntegrityRecordKind,
  id: string,
  scope: RootBusinessScope,
) {
  const { context, error } = await buildRepairContext(supabase, kind, id, scope);
  if (error || !context) return { detail: null, error: error || "record_not_found" };

  const suggestions = await searchContactCandidates(supabase, context);

  return {
    detail: {
      kind: context.kind,
      record_id: String(context.record.id),
      business_unit: context.businessUnit,
      record: context.record,
      linked_quote: context.linkedQuote,
      search_profile: context.searchProfile,
      suggestions,
      recommended_contact_id: suggestions[0]?.id || null,
    },
    error: null,
  };
}

async function ensureContactMembership(
  supabase: SupabaseClient,
  contactId: string | null,
  businessId: string | null,
) {
  if (!contactId || !businessId) return;
  await supabase
    .from("contact_business_map")
    .upsert([{ contact_id: contactId, business_id: businessId }], { onConflict: "contact_id,business_id" });
}

export async function repairIntegrityRecord(
  supabase: SupabaseClient,
  kind: IntegrityRecordKind,
  id: string,
  contactId: string,
  scope: RootBusinessScope,
) {
  const { context, error } = await buildRepairContext(supabase, kind, id, scope);
  if (error || !context) return { ok: false, error: error || "record_not_found" };

  const normalizedContactId = clean(contactId);
  if (!normalizedContactId) return { ok: false, error: "contact_id_required" };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id,full_name,name,email,phone,company")
    .eq("id", normalizedContactId)
    .maybeSingle();

  if (!contact?.id) return { ok: false, error: "contact_not_found" };

  const patch: Record<string, unknown> = {
    contact_id: normalizedContactId,
  };
  if (context.businessId) patch.business_id = context.businessId;
  if (context.businessUnit) patch.business_unit = context.businessUnit;
  if (kind === "invoice") patch.customer_id = normalizedContactId;

  const table = kind === "quote" ? "quotes" : kind === "invoice" ? "invoices" : "jobs";
  const { error: updateError } = await supabase
    .from(table)
    .update(patch)
    .eq("id", String(context.record.id));

  if (updateError) return { ok: false, error: updateError.message };

  if (context.linkedQuote?.id && !context.linkedQuote.contact_id) {
    await supabase
      .from("quotes")
      .update({
        contact_id: normalizedContactId,
        business_id: context.businessId,
        business_unit: context.businessUnit,
      })
      .eq("id", String(context.linkedQuote.id));
  }

  await ensureContactMembership(supabase, normalizedContactId, context.businessId);

  return {
    ok: true,
    repaired: {
      kind,
      record_id: String(context.record.id),
      contact_id: normalizedContactId,
      business_unit: context.businessUnit,
    },
    error: null,
  };
}
