import type { RootBusinessScope } from "@/lib/os-request-scope";
import { getSupabase } from "@/lib/supabase";

type RootGenericRow = Record<string, unknown>;
type RootInvoiceRow = RootGenericRow;
type RootContactRow = RootGenericRow;
type RootQuoteRow = RootGenericRow;
type RootPaymentRow = RootGenericRow;

export type RootContactListRecord = {
  id: string;
  name: string | null;
  full_name: string;
  last_activity: string | null;
  lifecycle: string;
  contact_type: string | null;
  open_invoice_count: number;
  accepted_quotes: number;
  segment: "supplier" | "customer";
  business_memberships: Array<{
    business_id: string;
    code: "ACS" | "CC";
    name: string;
  }>;
  workspace_memberships: Array<"ACS" | "CC">;
  preferred_channel: string | null;
  source: string | null;
  orbit_tier: string | null;
  tags: string[];
  lead_score: number;
  lead_status: string | null;
  priority_score: number;
  relationship_score: number;
  total_revenue: number;
  total_jobs: number;
  paid_invoice_count: number;
  open_quote_count: number;
  quote_count: number;
  outstanding_balance: number;
  relationship_rank: number;
  relationship_band: "priority" | "active" | "warming" | "monitor";
  last_conversation_at: string | null;
  open_conversation_count: number;
  conversation_channels: string[];
  sentiment_trend: string | null;
  client_code: string | null;
  account_code: string | null;
  preferences_summary: string | null;
  next_best_action: string;
};

function coerceText(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeScope(scope: RootBusinessScope | unknown) {
  return coerceText(scope)?.toUpperCase() || null;
}

function coerceNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

function coerceArrayText(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceText(item))
    .filter((item): item is string => Boolean(item));
}

function coerceObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toBusinessUnit(value: unknown, fallback: "ACS" | "CC" = "ACS") {
  const normalized = coerceText(value)?.toUpperCase();
  return normalized === "CC" ? "CC" : normalized === "ACS" ? "ACS" : fallback;
}

function toBusinessUnitOrNull(value: unknown) {
  const normalized = coerceText(value)?.toUpperCase();
  return normalized === "CC" || normalized === "ACS" ? normalized : null;
}

function inferBusinessCode(value: unknown): "ACS" | "CC" | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "acs" || normalized.includes("astro")) return "ACS";
  if (normalized === "cc" || normalized.includes("content") || normalized.includes("co-op")) return "CC";
  return null;
}

function pushTimestamp(timestamps: number[], value: unknown) {
  const text = coerceText(value);
  if (!text) return;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) timestamps.push(parsed);
}

function normalizeScore(value: unknown) {
  const amount = coerceNumber(value);
  if (amount <= 1) return Math.round(amount * 100);
  return Math.round(amount);
}

function deriveRelationshipBand(rank: number): RootContactListRecord["relationship_band"] {
  if (rank >= 85) return "priority";
  if (rank >= 65) return "active";
  if (rank >= 40) return "warming";
  return "monitor";
}

function derivePreferencesSummary(contact: RootContactRow) {
  const metadata = coerceObject(contact.metadata);
  const explicit =
    coerceText(metadata.preferences_summary) ||
    coerceText(metadata.preference_summary) ||
    coerceText(metadata.client_preferences) ||
    coerceText(metadata.service_preferences) ||
    coerceText(metadata.access_notes);
  if (explicit) return explicit;

  const parts = [
    coerceText(contact.preferred_channel || metadata.preferred_channel),
    coerceText(metadata.preferred_time),
    coerceText(metadata.tone),
    coerceText(metadata.cleaning_notes),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type RootContactIntelligenceContext = {
  membershipMap: Map<
    string,
    Array<{
      business_id: string;
      code: "ACS" | "CC";
      name: string;
    }>
  >;
  quoteMap: Map<
    string,
    {
      count: number;
      accepted: number;
      open: number;
      lastAt: string | null;
    }
  >;
  invoiceMap: Map<
    string,
    {
      open: number;
      paid: number;
      totalRevenue: number;
      outstanding: number;
      lastAt: string | null;
    }
  >;
  conversationMap: Map<
    string,
    {
      open: number;
      lastAt: string | null;
      channels: string[];
    }
  >;
  eventMap: Map<string, string | null>;
};

async function loadRootContactIntelligence(contactIds: string[], scope: RootBusinessScope = null): Promise<RootContactIntelligenceContext> {
  const sb = getSupabase();
  const ids = Array.from(new Set(contactIds.filter(Boolean)));

  if (ids.length === 0) {
    return {
      membershipMap: new Map(),
      quoteMap: new Map(),
      invoiceMap: new Map(),
      conversationMap: new Map(),
      eventMap: new Map(),
    };
  }

  const [businessMapResult, businessResult, quoteResult, invoiceResult, conversationResult, eventResult] = await Promise.all([
    sb.from("contact_business_map").select("contact_id,business_id").in("contact_id", ids),
    sb.from("businesses").select("id,name"),
    buildScopeQuery(
      sb
        .from("quotes")
        .select("id,contact_id,business_unit,estimated_total,total,internal_status,client_status,created_at")
        .in("contact_id", ids),
      scope,
    ),
    buildScopeQuery(
      sb
        .from("invoices")
        .select("id,contact_id,business_unit,total,amount,balance_due,paid_amount,amount_paid,payment_status,status,created_at")
        .in("contact_id", ids),
      scope,
    ),
    sb
      .from("conversations")
      .select("contact_id,channel,last_message_at,resolved")
      .in("contact_id", ids),
    sb
      .from("events")
      .select("contact_id,created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const businessNameMap = new Map(
    ((businessResult.data as RootGenericRow[] | null) || []).map((business) => [String(business.id), String(business.name || "")]),
  );

  const membershipMap = new Map<string, Array<{ business_id: string; code: "ACS" | "CC"; name: string }>>();
  for (const row of (businessMapResult.data as RootGenericRow[] | null) || []) {
    const contactId = String(row.contact_id || "");
    const businessId = String(row.business_id || "");
    if (!contactId || !businessId) continue;
    const name = businessNameMap.get(businessId) || businessId;
    const code = inferBusinessCode(name);
    if (!code) continue;
    const existing = membershipMap.get(contactId) || [];
    existing.push({ business_id: businessId, code, name });
    membershipMap.set(contactId, existing);
  }

  const quoteMap = new Map<string, { count: number; accepted: number; open: number; lastAt: string | null }>();
  for (const quote of (quoteResult.data as RootQuoteRow[] | null) || []) {
    const contactId = coerceText(quote.contact_id);
    if (!contactId) continue;
    const existing = quoteMap.get(contactId) || { count: 0, accepted: 0, open: 0, lastAt: null };
    const internal = String(quote.internal_status || "").toLowerCase();
    const client = String(quote.client_status || "").toLowerCase();
    const accepted = internal === "accepted" || internal === "ready_to_invoice" || client === "accepted";
    const closed = accepted || client === "declined" || internal === "converted_to_invoice" || internal === "expired";
    existing.count += 1;
    if (accepted) existing.accepted += 1;
    if (!closed) existing.open += 1;
    const createdAt = coerceText(quote.created_at);
    if (createdAt && (!existing.lastAt || Date.parse(createdAt) > Date.parse(existing.lastAt))) existing.lastAt = createdAt;
    quoteMap.set(contactId, existing);
  }

  const invoiceMap = new Map<string, { open: number; paid: number; totalRevenue: number; outstanding: number; lastAt: string | null }>();
  for (const invoice of (invoiceResult.data as RootInvoiceRow[] | null) || []) {
    const contactId = coerceText(invoice.contact_id);
    if (!contactId) continue;
    const existing = invoiceMap.get(contactId) || { open: 0, paid: 0, totalRevenue: 0, outstanding: 0, lastAt: null };
    const total = coerceNumber(invoice.total || invoice.amount);
    const paidAmount = coerceNumber(invoice.paid_amount || invoice.amount_paid);
    const balance = coerceNumber(invoice.balance_due || Math.max(total - paidAmount, 0));
    const paymentStatus = String(invoice.payment_status || invoice.status || "").toLowerCase();
    if (paymentStatus === "paid" || (total > 0 && balance <= 0)) existing.paid += 1;
    else existing.open += 1;
    existing.totalRevenue += total;
    existing.outstanding += balance;
    const createdAt = coerceText(invoice.created_at);
    if (createdAt && (!existing.lastAt || Date.parse(createdAt) > Date.parse(existing.lastAt))) existing.lastAt = createdAt;
    invoiceMap.set(contactId, existing);
  }

  const conversationMap = new Map<string, { open: number; lastAt: string | null; channels: string[] }>();
  for (const conversation of (conversationResult.data as RootGenericRow[] | null) || []) {
    const contactId = coerceText(conversation.contact_id);
    if (!contactId) continue;
    const existing = conversationMap.get(contactId) || { open: 0, lastAt: null, channels: [] };
    const channel = coerceText(conversation.channel);
    if (channel && !existing.channels.includes(channel)) existing.channels.push(channel);
    if (!coerceBoolean(conversation.resolved)) existing.open += 1;
    const lastMessageAt = coerceText(conversation.last_message_at);
    if (lastMessageAt && (!existing.lastAt || Date.parse(lastMessageAt) > Date.parse(existing.lastAt))) existing.lastAt = lastMessageAt;
    conversationMap.set(contactId, existing);
  }

  const eventMap = new Map<string, string | null>();
  for (const event of (eventResult.data as RootGenericRow[] | null) || []) {
    const contactId = coerceText(event.contact_id);
    if (!contactId || eventMap.has(contactId)) continue;
    eventMap.set(contactId, coerceText(event.created_at));
  }

  return {
    membershipMap,
    quoteMap,
    invoiceMap,
    conversationMap,
    eventMap,
  };
}

function buildRootContactRecord(
  contact: RootContactRow,
  context: RootContactIntelligenceContext,
): RootContactListRecord & RootContactRow {
  const contactId = String(contact.id || "");
  const metadata = coerceObject(contact.metadata);
  const membershipEntries = [...(context.membershipMap.get(contactId) || [])];
  const rowBusinessUnit = toBusinessUnitOrNull(contact.business_unit);
  if (rowBusinessUnit && !membershipEntries.some((entry) => entry.code === rowBusinessUnit)) {
    membershipEntries.push({
      business_id: rowBusinessUnit,
      code: rowBusinessUnit,
      name: rowBusinessUnit === "ACS" ? "Astro Cleanings" : "Content Co-op",
    });
  }

  const memberships = membershipEntries
    .reduce<Array<{ business_id: string; code: "ACS" | "CC"; name: string }>>((acc, entry) => {
      if (acc.some((existing) => existing.code === entry.code && existing.business_id === entry.business_id)) return acc;
      acc.push(entry);
      return acc;
    }, [])
    .sort((left, right) => left.code.localeCompare(right.code));

  const workspaceMemberships = memberships.map((entry) => entry.code);
  const quoteStats = context.quoteMap.get(contactId) || { count: 0, accepted: 0, open: 0, lastAt: null };
  const invoiceStats = context.invoiceMap.get(contactId) || {
    open: 0,
    paid: 0,
    totalRevenue: coerceNumber(contact.total_revenue),
    outstanding: 0,
    lastAt: null,
  };
  const conversationStats = context.conversationMap.get(contactId) || { open: 0, lastAt: null, channels: [] };
  const eventAt = context.eventMap.get(contactId) || null;

  const timestamps: number[] = [];
  pushTimestamp(timestamps, contact.last_activity);
  pushTimestamp(timestamps, contact.last_contacted);
  pushTimestamp(timestamps, quoteStats.lastAt);
  pushTimestamp(timestamps, invoiceStats.lastAt);
  pushTimestamp(timestamps, conversationStats.lastAt);
  pushTimestamp(timestamps, eventAt);
  pushTimestamp(timestamps, contact.created_at);
  const lastActivity = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  const contactType = coerceText(contact.contact_type);
  const lifecycle = coerceText((contact as RootContactRow).lifecycle) || contactType || "customer";
  const priorityScore = Math.max(normalizeScore(contact.priority_score), normalizeScore(metadata.priority_score));
  const leadScore = Math.max(normalizeScore(contact.lead_score), normalizeScore(metadata.lead_score), normalizeScore(contact.engagement_score));
  const relationshipScore = Math.max(normalizeScore(contact.relationship_score), normalizeScore(metadata.relationship_score));
  const revenueScore = Math.min(25, Math.round(invoiceStats.totalRevenue / 2000));
  const freshnessScore = (() => {
    if (!lastActivity) return 0;
    const ageDays = Math.max(0, Math.round((Date.now() - Date.parse(lastActivity)) / 86400000));
    if (ageDays <= 7) return 15;
    if (ageDays <= 30) return 10;
    if (ageDays <= 90) return 6;
    return 2;
  })();
  const conversationScore = Math.min(10, conversationStats.open * 3 + conversationStats.channels.length * 2);
  const quoteScore = Math.min(15, quoteStats.accepted * 5 + quoteStats.count);
  const relationshipRank = Math.min(
    100,
    Math.max(
      relationshipScore,
      Math.round(relationshipScore * 0.35 + priorityScore * 0.2 + leadScore * 0.15 + revenueScore + freshnessScore + conversationScore + quoteScore),
    ),
  );
  const relationshipBand = deriveRelationshipBand(relationshipRank);

  const cadenceOverdue = coerceBoolean(contact.cadence_overdue || metadata.cadence_overdue);
  const preferredChannel =
    coerceText(contact.preferred_channel) ||
    coerceText(metadata.preferred_channel) ||
    (conversationStats.channels.includes("imessage") ? "imessage" : conversationStats.channels[0] || null);
  const outstandingBalance = Math.round(invoiceStats.outstanding * 100) / 100;
  const nextBestAction =
    conversationStats.open > 0
      ? "reply in active lane"
      : outstandingBalance > 0
        ? "collect payment"
        : quoteStats.open > 0
          ? "follow up quote"
          : cadenceOverdue
            ? "re-engage recurring client"
            : ["lead", "prospect"].includes(String(contactType || "").toLowerCase())
              ? "qualify lead"
              : "review relationship";

  return {
    ...contact,
    id: contactId,
    name: coerceText(contact.name),
    full_name: coerceText(contact.full_name) || coerceText(contact.name) || "unnamed contact",
    lifecycle,
    contact_type: contactType,
    open_invoice_count: invoiceStats.open,
    accepted_quotes: quoteStats.accepted,
    last_activity: lastActivity,
    segment: ["vendor", "supplier"].includes(lifecycle.toLowerCase()) ? "supplier" : "customer",
    business_memberships: memberships,
    workspace_memberships: workspaceMemberships,
    preferred_channel: preferredChannel,
    source: coerceText(contact.source) || coerceText(metadata.source),
    orbit_tier: coerceText(contact.orbit_tier) || coerceText(metadata.orbit_tier),
    tags: coerceArrayText(contact.tags).length ? coerceArrayText(contact.tags) : coerceArrayText(metadata.tags),
    lead_score: leadScore,
    lead_status: coerceText(contact.lead_status) || coerceText(metadata.lead_status),
    priority_score: priorityScore,
    relationship_score: relationshipScore,
    total_revenue: Math.round(invoiceStats.totalRevenue * 100) / 100,
    total_jobs: Math.max(coerceNumber(contact.total_jobs), coerceNumber(metadata.total_jobs)),
    paid_invoice_count: invoiceStats.paid,
    open_quote_count: quoteStats.open,
    quote_count: quoteStats.count,
    outstanding_balance: outstandingBalance,
    relationship_rank: relationshipRank,
    relationship_band: relationshipBand,
    last_conversation_at: conversationStats.lastAt,
    open_conversation_count: conversationStats.open,
    conversation_channels: conversationStats.channels,
    sentiment_trend: coerceText(contact.sentiment_trend) || coerceText(metadata.sentiment_trend),
    client_code:
      coerceText(contact.client_code) ||
      coerceText(metadata.client_code) ||
      coerceText(metadata.customer_code) ||
      null,
    account_code:
      coerceText(contact.account_code) ||
      coerceText(metadata.account_code) ||
      coerceText(metadata.billing_code) ||
      null,
    preferences_summary: derivePreferencesSummary(contact),
    next_best_action: nextBestAction,
  };
}

type ScopeQueryable<T> = T & {
  eq(column: string, value: string): unknown;
};

function buildScopeQuery<T>(query: T, scope: RootBusinessScope) {
  const normalized = normalizeScope(scope);
  if (!normalized) return query;
  const scopedQuery = query as ScopeQueryable<T>;
  return scopedQuery.eq("business_unit", normalized) as T;
}

const CONTACT_SELECT_WITH_ACTIVITY =
  "id,full_name,name,email,phone,company,business_unit,status,created_at,last_contacted,last_activity,contact_type,orbit_tier,priority_score";
const CONTACT_SELECT_FALLBACK =
  "id,full_name,name,email,phone,company,business_unit,status,created_at,last_contacted,contact_type,orbit_tier,priority_score";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, columnName: string) {
  if (!error) return false;
  return error.code === "42703" && String(error.message || "").toLowerCase().includes(columnName.toLowerCase());
}

function deriveInvoiceStatus(invoice: RootInvoiceRow) {
  return (
    coerceText(invoice.invoice_status) ||
    coerceText(invoice.status) ||
    (coerceNumber(invoice.balance_due) <= 0 && coerceNumber(invoice.total || invoice.amount) > 0 ? "paid" : "draft")
  );
}

function derivePaymentStatus(invoice: RootInvoiceRow) {
  if (coerceText(invoice.payment_status)) return String(invoice.payment_status);
  const total = coerceNumber(invoice.total || invoice.amount);
  const paid = coerceNumber(invoice.paid_amount || invoice.amount_paid);
  const balance = coerceNumber(invoice.balance_due || total - paid);
  if (total > 0 && balance <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

function deriveReminderStatus(invoice: RootInvoiceRow) {
  if (coerceText(invoice.reminder_status)) return String(invoice.reminder_status);
  return invoice.reminder_sent_at || invoice.reminderSentAt ? "sent" : "idle";
}

function derivePaymentLinkStatus(invoice: RootInvoiceRow) {
  if (coerceText(invoice.payment_link_status)) return String(invoice.payment_link_status);
  return invoice.stripe_payment_link ? "payment_ready" : "payment_missing";
}

function deriveReconciliationStatus(invoice: RootInvoiceRow) {
  if (coerceText(invoice.reconciliation_status)) return String(invoice.reconciliation_status);
  return derivePaymentStatus(invoice) === "paid" ? "pending" : "not_started";
}

function deriveNextAction(invoice: RootInvoiceRow) {
  if (coerceText(invoice.next_action)) return String(invoice.next_action);
  const paymentStatus = derivePaymentStatus(invoice);
  if (paymentStatus === "paid") return "archive when reconciled";
  if (!invoice.stripe_payment_link) return "generate pay link";
  const dueValue = invoice.due_date || invoice.due_at;
  if (dueValue) {
    const due = new Date(String(dueValue));
    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return "collect payment";
  }
  return "send or resend invoice";
}

function normalizeLineItems(rawItems: unknown, fallbackPhase = "scope") {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item, index) => {
    const row = coerceObject(item);
    const quantity = coerceNumber(row.quantity || 1);
    const unitPrice = coerceNumber(row.unit_price || row.unitPrice);
    return {
      id: String(row.id || `${fallbackPhase}-${index + 1}`),
      description: coerceText(row.description) || `line item ${index + 1}`,
      phase_name: coerceText(row.phase_name) || coerceText(row.name) || fallbackPhase,
      quantity,
      unit: coerceText(row.unit) || "each",
      unit_price: unitPrice,
      line_total: coerceNumber(row.line_total || row.total || row.lineTotal || quantity * unitPrice),
    };
  });
}

function normalizeInvoiceListRow(invoice: RootInvoiceRow, contact?: RootContactRow | null, paymentCount = 0) {
  const total = coerceNumber(invoice.total || invoice.amount);
  const paidAmount = coerceNumber(invoice.paid_amount || invoice.amount_paid);
  const balanceDue = coerceNumber(invoice.balance_due || Math.max(total - paidAmount, 0));
  const invoiceNumber = coerceText(invoice.invoice_number) || coerceText(invoice.invoiceNumber);

  return {
    ...invoice,
    id: String(invoice.id || ""),
    invoice_number: invoiceNumber,
    invoiceNumber,
    contact_id: coerceText(invoice.contact_id),
    quote_id: coerceText(invoice.quote_id),
    status: coerceText(invoice.status) || "draft",
    created_at: invoice.created_at || null,
    stripe_payment_link: coerceText(invoice.stripe_payment_link),
    notes: coerceText(invoice.notes),
    due_date: coerceText(invoice.due_date),
    due_at: coerceText(invoice.due_at),
    tax: coerceNumber(invoice.tax),
    total,
    amount: total,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    business_unit: toBusinessUnit(invoice.business_unit),
    invoice_status: deriveInvoiceStatus(invoice),
    payment_status: derivePaymentStatus(invoice),
    payment_link_status: derivePaymentLinkStatus(invoice),
    reminder_status: deriveReminderStatus(invoice),
    reconciliation_status: deriveReconciliationStatus(invoice),
    next_action: deriveNextAction(invoice),
    payment_count: paymentCount,
    contact_name: coerceText(contact?.full_name) || coerceText(contact?.name) || coerceText(invoice.client_name) || null,
    contact_company: coerceText(contact?.company) || null,
    contact_email: coerceText(contact?.email) || coerceText(invoice.client_email) || null,
    contact_phone: coerceText(contact?.phone) || coerceText(invoice.client_phone) || null,
  };
}

export async function getRootContacts(limit = 500, scope: RootBusinessScope = null) {
  const sb = getSupabase();
  const cappedLimit = Math.min(Math.max(limit, 1), 750);
  let query = sb.from("contacts").select("*");

  query = buildScopeQuery(query, scope);

  const initialResult = await query.order("created_at", { ascending: false }).limit(cappedLimit);
  let data: RootContactRow[] | null = (initialResult.data as RootContactRow[] | null) ?? null;
  let error = initialResult.error;
  if (isMissingColumnError(error, "last_activity")) {
    let fallbackQuery = sb.from("contacts").select("*");
    fallbackQuery = buildScopeQuery(fallbackQuery, scope);
    const fallbackResult = await fallbackQuery.order("created_at", { ascending: false }).limit(cappedLimit);
    data = (fallbackResult.data as RootContactRow[] | null) ?? null;
    error = fallbackResult.error;
  }

  const intelligence = await loadRootContactIntelligence((data || []).map((contact: RootContactRow) => String(contact.id || "")), scope);

  return {
    contacts: (data || []).map((contact: RootContactRow): RootContactListRecord & RootContactRow =>
      buildRootContactRecord(contact, intelligence),
    ),
    error: error?.message || null,
  };
}

export async function getRootContactDossier(id: string, scope: RootBusinessScope = null) {
  const sb = getSupabase();

  let contactResult = (await sb
    .from("contacts")
    .select(CONTACT_SELECT_WITH_ACTIVITY)
    .eq("id", id)
    .maybeSingle()) as { data: RootContactRow | null; error: { code?: string; message?: string } | null };

  if (isMissingColumnError(contactResult.error, "last_activity")) {
    contactResult = (await sb
      .from("contacts")
      .select(CONTACT_SELECT_FALLBACK)
      .eq("id", id)
      .maybeSingle()) as { data: RootContactRow | null; error: { code?: string; message?: string } | null };
  }

  const { data: contact, error } = contactResult;

  if (error) return { dossier: null, error: error.message };
  if (!contact) return { dossier: null, error: "Contact not found" };

  const contactScope = normalizeScope(scope);
  const rowScope = normalizeScope(contact.business_unit || null);
  if (contactScope && rowScope && rowScope !== contactScope) {
    return { dossier: null, error: "Contact not found" };
  }

  const [{ data: quotes }, { data: invoices }] = await Promise.all([
    buildScopeQuery(
      sb.from("quotes").select("id,quote_number,estimated_total,total,internal_status,client_status,valid_until,created_at").eq("contact_id", id),
      scope,
    ).order("created_at", { ascending: false }).limit(20),
    buildScopeQuery(
      sb.from("invoices").select("id,invoice_number,total,amount,balance_due,paid_amount,amount_paid,status,payment_status,due_date,due_at,created_at").eq("contact_id", id),
      scope,
    ).order("created_at", { ascending: false }).limit(20),
  ]);

  const normalizedInvoices = (invoices || []).map((invoice: RootInvoiceRow) => normalizeInvoiceListRow(invoice, contact, 0));
  const intelligence = await loadRootContactIntelligence([id], scope);
  const contactRecord = buildRootContactRecord(contact, intelligence);

  return {
    dossier: {
      ...contactRecord,
      open_invoice_count: normalizedInvoices.filter((invoice) => String(invoice.payment_status).toLowerCase() !== "paid").length,
      overdue_amount: normalizedInvoices
        .filter((invoice) => {
          const dueValue = invoice.due_date || invoice.due_at;
          if (!dueValue || String(invoice.payment_status).toLowerCase() === "paid") return false;
          const due = new Date(String(dueValue));
          return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
        })
        .reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0),
      accepted_quotes: (quotes || []).filter((quote: RootQuoteRow) => {
        const internal = String(quote.internal_status || "").toLowerCase();
        const client = String(quote.client_status || "").toLowerCase();
        return internal === "accepted" || internal === "ready_to_invoice" || client === "accepted";
      }).length,
      quotes: quotes || [],
      invoices: normalizedInvoices,
    },
    error: null,
  };
}

export async function getRootInvoices(limit = 200, scope: RootBusinessScope = null) {
  const sb = getSupabase();
  let invoiceQuery = sb
    .from("invoices")
    .select("id,invoice_number,amount,tax,total,status,invoice_status,payment_status,business_unit,created_at,contact_id,quote_id,notes,due_date,due_at,balance_due,paid_amount,amount_paid,stripe_payment_link,reminder_status,reconciliation_status,next_action,client_name,client_email,client_phone")
    .order("created_at", { ascending: false })
    .limit(limit);

  invoiceQuery = buildScopeQuery(invoiceQuery, scope);

  const { data: invoices, error } = await invoiceQuery;
  if (error) return { invoices: [], error: error.message };

  const contactIds = Array.from(new Set((invoices || []).map((invoice: RootInvoiceRow) => coerceText(invoice.contact_id)).filter(Boolean))) as string[];
  const invoiceIds = (invoices || []).map((invoice: RootInvoiceRow) => String(invoice.id));

  const [{ data: contacts }, { data: paymentRows }] = await Promise.all([
    contactIds.length
      ? sb.from("contacts").select("id,full_name,name,email,phone,company").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    invoiceIds.length
      ? sb.from("invoice_payments").select("id,invoice_id,amount,status,method,created_at").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
  ]);

  const contactMap = new Map((contacts || []).map((contact: RootContactRow) => [String(contact.id), contact]));
  const paymentCountMap = new Map<string, number>();
  for (const row of paymentRows || []) {
    const invoiceId = String((row as RootPaymentRow).invoice_id || "");
    paymentCountMap.set(invoiceId, (paymentCountMap.get(invoiceId) || 0) + 1);
  }

  return {
    invoices: (invoices || []).map((invoice: RootInvoiceRow) =>
      normalizeInvoiceListRow(invoice, contactMap.get(String(invoice.contact_id || "")) || null, paymentCountMap.get(String(invoice.id)) || 0),
    ),
    error: null,
  };
}

export async function getRootInvoiceDetail(id: string, scope: RootBusinessScope = null) {
  const sb = getSupabase();

  const { data: invoice, error } = await sb
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { invoice: null, error: error.message };
  if (!invoice) return { invoice: null, error: "invoice_not_found" };

  const invoiceScope = normalizeScope(invoice.business_unit || null);
  const requestedScope = normalizeScope(scope);
  if (requestedScope && invoiceScope && requestedScope !== invoiceScope) {
    return { invoice: null, error: "invoice_not_found" };
  }

  const [{ data: contact }, { data: sourceQuote }, { data: quoteItems }, { data: invoicePayments }] = await Promise.all([
    invoice.contact_id
      ? sb.from("contacts").select("id,full_name,name,email,phone,company").eq("id", invoice.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? sb.from("quotes").select("id,quote_number,internal_status,client_status,payment_terms,valid_until,estimated_total").eq("id", invoice.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? sb.from("quote_items").select("id,description,phase_name,name,quantity,unit,unit_price,total,line_total").eq("quote_id", invoice.quote_id).order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    sb.from("invoice_payments").select("id,invoice_id,amount,status,method,created_at").eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);

  const base = normalizeInvoiceListRow(invoice, contact, (invoicePayments || []).length);
  const lineItems = normalizeLineItems(invoice.line_items, "scope");
  const fallbackItems = lineItems.length > 0 ? lineItems : normalizeLineItems(quoteItems || [], "scope");
  const payments = (invoicePayments || []).map((payment: RootPaymentRow) => ({
    id: String(payment.id),
    amount: coerceNumber(payment.amount),
    method: coerceText(payment.method) || "manual",
    status: coerceText(payment.status) || "pending",
    created_at: coerceText(payment.created_at),
  }));

  return {
    invoice: {
      ...base,
      invoice_number: coerceText(invoice.invoice_number) || coerceText((invoice as RootInvoiceRow).invoiceNumber),
      invoiceNumber: coerceText(invoice.invoice_number) || coerceText((invoice as RootInvoiceRow).invoiceNumber),
      notes: coerceText(invoice.notes),
      amount_due: coerceNumber(base.total || base.amount),
      due_date: coerceText(invoice.due_date) || coerceText(invoice.due_at),
      due_at: coerceText(invoice.due_at) || coerceText(invoice.due_date),
      last_reminder_at: invoice.last_reminder_at || invoice.reminder_sent_at || invoice.reminderSentAt || null,
      stripe_payment_link: coerceText(invoice.stripe_payment_link),
      line_items: fallbackItems,
      payments,
      source_quote: sourceQuote
        ? {
            id: String(sourceQuote.id),
            quote_number: coerceText(sourceQuote.quote_number),
            internal_status: coerceText(sourceQuote.internal_status) || coerceText(sourceQuote.client_status) || "draft",
            payment_terms: coerceText(sourceQuote.payment_terms),
            valid_until: sourceQuote.valid_until || null,
            estimated_total: coerceNumber(sourceQuote.estimated_total),
          }
        : null,
    },
    error: null,
  };
}

export async function getRootFinance(limit = 200, scope: RootBusinessScope = null) {
  const sb = getSupabase();
  const normalizedScope = normalizeScope(scope);

  let invoicesQuery = sb
    .from("invoices")
    .select("id,invoice_number,amount,tax,total,status,business_unit,created_at,contact_id,notes");
  let quotesQuery = sb
    .from("quotes")
    .select("id,quote_number,estimated_total,total,status,business_unit,created_at,client_name,notes");

  if (normalizedScope) {
    invoicesQuery = invoicesQuery.eq("business_unit", normalizedScope);
    quotesQuery = quotesQuery.eq("business_unit", normalizedScope);
  }

  const [invoicesRes, quotesRes] = await Promise.all([
    invoicesQuery.order("created_at", { ascending: false }).limit(limit),
    quotesQuery.order("created_at", { ascending: false }).limit(limit),
  ]);

  const rows = [
    ...((invoicesRes.data || []).map((i: RootInvoiceRow) => ({
      id: i.id,
      type: "invoice",
      description: i.invoice_number || `INV-${String(i.id).slice(0, 8)}`,
      amount: i.total || i.amount || 0,
      status: i.status || "draft",
      business_unit: i.business_unit || "ACS",
      date: i.created_at,
      contact_name: "",
      source:
        typeof i.notes === "string" && (i.notes.includes("bank") || i.notes.includes("parsed"))
          ? "bank_statement"
          : "manual",
    })) as Record<string, unknown>[]),
    ...((quotesRes.data || []).map((q: RootQuoteRow) => ({
      id: q.id,
      type: "quote",
      description: q.quote_number ? `Q-${q.quote_number}` : `Q-${String(q.id).slice(0, 8)}`,
      amount: q.estimated_total || q.total || 0,
      status: q.status || "draft",
      business_unit: q.business_unit || "ACS",
      date: q.created_at,
      contact_name: q.client_name || "",
      source:
        typeof q.notes === "string" && q.notes.includes("Auto-generated") ? "auto" : "manual",
    })) as Record<string, unknown>[]),
  ].sort(
    (a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime(),
  );

  return {
    finance: rows,
    error: invoicesRes.error?.message || quotesRes.error?.message || null,
  };
}
