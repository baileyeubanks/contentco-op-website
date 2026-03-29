/**
 * ROOT Contacts Engine — Attio-pattern contacts, companies, relationships, timeline, lead scoring.
 */

import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/root-event-log";
import type { RootBusinessScope } from "@/lib/root-request-scope";

// ─── Companies ───

export async function getCompanies(scope: RootBusinessScope = null, limit = 100) {
  const sb = getSupabase();
  let query = sb.from("companies").select("*").order("created_at", { ascending: false }).limit(limit);
  if (scope) query = query.eq("business_unit", scope);
  const { data, error } = await query;
  return { companies: data || [], error: error?.message || null };
}

export async function getCompanyById(id: string) {
  const sb = getSupabase();
  const [{ data: company, error }, { data: relationships }, { data: contacts }] = await Promise.all([
    sb.from("companies").select("*").eq("id", id).maybeSingle(),
    sb.from("relationships").select("*, contacts(id, full_name, name, email, phone)").eq("company_id", id),
    sb.from("contacts").select("id, full_name, name, email, phone, contact_type, lead_score").eq("company_id", id),
  ]);

  return {
    company,
    relationships: relationships || [],
    contacts: contacts || [],
    error: error?.message || null,
  };
}

export async function createCompany(data: {
  business_unit: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  logo_url?: string;
  billing_address?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const { data: company, error } = await sb
    .from("companies")
    .insert({
      business_unit: data.business_unit || "CC",
      name: data.name,
      domain: data.domain || null,
      industry: data.industry || null,
      size: data.size || null,
      logo_url: data.logo_url || null,
      billing_address: data.billing_address || null,
    })
    .select()
    .single();

  if (company) {
    await emitTypedEvent({
      type: "company.created",
      objectType: "company",
      objectId: company.id,
      businessUnit: (data.business_unit as "ACS" | "CC") || "CC",
      text: `Company "${data.name}" created`,
    });
  }

  return { company, error: error?.message || null };
}

export async function updateCompany(id: string, updates: Record<string, unknown>) {
  const sb = getSupabase();
  const { data: company, error } = await sb
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (company) {
    await emitTypedEvent({
      type: "company.updated",
      objectType: "company",
      objectId: id,
      businessUnit: (company.business_unit as "ACS" | "CC") || "CC",
      text: `Company "${company.name}" updated`,
    });
  }

  return { company, error: error?.message || null };
}

// ─── Relationships ───

export async function createRelationship(data: {
  contact_id: string;
  company_id: string;
  role?: string;
  relationship_type?: string;
  is_primary?: boolean;
}) {
  const sb = getSupabase();
  const { data: relationship, error } = await sb
    .from("relationships")
    .insert({
      contact_id: data.contact_id,
      company_id: data.company_id,
      role: data.role || null,
      relationship_type: data.relationship_type || "employee",
      is_primary: data.is_primary ?? false,
    })
    .select()
    .single();

  if (relationship) {
    await emitTypedEvent({
      type: "relationship.created",
      objectType: "contact",
      objectId: data.contact_id,
      text: `Relationship created with company`,
      payload: { company_id: data.company_id, relationship_type: data.relationship_type || "employee" },
    });
  }

  return { relationship, error: error?.message || null };
}

export async function getContactRelationships(contactId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("relationships")
    .select("*, companies(id, name, domain, industry)")
    .eq("contact_id", contactId);

  return { relationships: data || [], error: error?.message || null };
}

// ─── Contact Timeline ───

export async function getContactTimeline(contactId: string, limit = 50) {
  const sb = getSupabase();

  const [{ data: events }, { data: invoices }, { data: quotes }] = await Promise.all([
    sb.from("events")
      .select("id, type, text, payload, created_at, object_type, object_id, event_category")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(limit),
    sb.from("invoices")
      .select("id, invoice_number, total, status, payment_status, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("quotes")
      .select("id, quote_number, total, internal_status, client_status, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Merge into unified timeline
  type TimelineItem = { id: string; type: string; label: string; detail: string | null; created_at: string; source: string };

  const timeline: TimelineItem[] = [
    ...(events || []).map((e) => ({
      id: e.id,
      type: e.type,
      label: e.text || e.type,
      detail: null,
      created_at: e.created_at,
      source: "event" as const,
    })),
    ...(invoices || []).map((inv) => ({
      id: inv.id,
      type: "invoice",
      label: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)} — $${Number(inv.total || 0).toFixed(2)}`,
      detail: `Status: ${inv.payment_status || inv.status || "draft"}`,
      created_at: inv.created_at,
      source: "invoice" as const,
    })),
    ...(quotes || []).map((q) => ({
      id: q.id,
      type: "quote",
      label: `Quote ${q.quote_number || q.id.slice(0, 8)} — $${Number(q.total || 0).toFixed(2)}`,
      detail: `Status: ${q.internal_status || q.client_status || "draft"}`,
      created_at: q.created_at,
      source: "quote" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { timeline, error: null };
}

// ─── Lead Scoring ───

export async function computeLeadScore(contactId: string) {
  const sb = getSupabase();

  const [{ data: events }, { data: invoices }, { data: opportunities }] = await Promise.all([
    sb.from("events").select("id, created_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(100),
    sb.from("invoices").select("id, total, payment_status").eq("contact_id", contactId),
    sb.from("opportunities").select("id, value_cents, stage").eq("contact_id", contactId),
  ]);

  let score = 0;

  // Recency: +20 if active in last 7 days, +10 if last 30 days
  const lastEvent = events?.[0]?.created_at;
  if (lastEvent) {
    const daysSince = (Date.now() - new Date(lastEvent).getTime()) / 86400000;
    if (daysSince <= 7) score += 20;
    else if (daysSince <= 30) score += 10;
  }

  // Activity volume: +2 per event, max 20
  score += Math.min((events?.length || 0) * 2, 20);

  // Revenue: +15 if has paid invoices, +5 per paid invoice (max 20)
  const paidInvoices = (invoices || []).filter((i) => i.payment_status === "paid");
  if (paidInvoices.length > 0) score += 15;
  score += Math.min(paidInvoices.length * 5, 20);

  // Pipeline: +10 per open opportunity, +20 if any won
  const openOpps = (opportunities || []).filter((o) => !["closed_won", "closed_lost"].includes(o.stage));
  const wonOpps = (opportunities || []).filter((o) => o.stage === "closed_won");
  score += Math.min(openOpps.length * 10, 20);
  if (wonOpps.length > 0) score += 20;

  // Cap at 100
  score = Math.min(score, 100);

  // Determine lead status
  let leadStatus = "new";
  if (score >= 80) leadStatus = "qualified";
  else if (score >= 50) leadStatus = "contacted";
  else if (score >= 20) leadStatus = "nurturing";

  // Update contact
  await sb.from("contacts").update({ lead_score: score, lead_status: leadStatus }).eq("id", contactId);

  await emitTypedEvent({
    type: "contact.score_changed",
    objectType: "contact",
    objectId: contactId,
    text: `Lead score updated to ${score}`,
    payload: { score, lead_status: leadStatus },
  });

  return { score, lead_status: leadStatus };
}

export async function batchComputeLeadScores(scope: RootBusinessScope = null, limit = 200) {
  const sb = getSupabase();
  let query = sb.from("contacts").select("id").limit(limit);
  if (scope) query = query.eq("business_unit", scope);
  const { data: contacts } = await query;

  const results = [];
  for (const contact of contacts || []) {
    const result = await computeLeadScore(contact.id);
    results.push({ id: contact.id, ...result });
  }

  return { scored: results.length, results };
}

// ─── Contact Merge ───

export async function mergeContacts(sourceId: string, targetId: string) {
  const sb = getSupabase();

  // Reassign all related records from source to target
  await Promise.all([
    sb.from("relationships").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("invoices").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("quotes").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("payments").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("opportunities").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("campaign_contacts").update({ contact_id: targetId }).eq("contact_id", sourceId),
    sb.from("events").update({ contact_id: targetId }).eq("contact_id", sourceId),
  ]);

  // Soft-delete source contact
  await sb.from("contacts").update({ status: "merged", metadata: { merged_into: targetId } }).eq("id", sourceId);

  await emitTypedEvent({
    type: "contact.merged",
    objectType: "contact",
    objectId: targetId,
    text: `Contact ${sourceId.slice(0, 8)} merged into ${targetId.slice(0, 8)}`,
    payload: { source_id: sourceId, target_id: targetId },
  });

  return { ok: true, merged_into: targetId };
}
