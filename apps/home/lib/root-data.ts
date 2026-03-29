import type { RootBusinessScope } from "@/lib/root-request-scope";
import { getSupabase } from "@/lib/supabase";

type RootInvoiceRow = Record<string, any>;
type RootContactRow = Record<string, any>;
type RootQuoteRow = Record<string, any>;
type RootPaymentRow = Record<string, any>;

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
};

function normalizeScope(scope: RootBusinessScope) {
  return scope ? String(scope).trim().toUpperCase() : null;
}

function coerceText(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function coerceNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toStatus(value: unknown, fallback: string) {
  return coerceText(value)?.toLowerCase() || fallback;
}

function toBusinessUnit(value: unknown, fallback: "ACS" | "CC" = "ACS") {
  const normalized = coerceText(value)?.toUpperCase();
  return normalized === "CC" ? "CC" : normalized === "ACS" ? "ACS" : fallback;
}

function buildScopeQuery<T>(query: T, scope: RootBusinessScope) {
  const normalized = normalizeScope(scope);
  if (!normalized) return query as T;
  return (query as any).eq("business_unit", normalized) as T;
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
  return rawItems.map((item: any, index) => ({
    id: String(item?.id || `${fallbackPhase}-${index + 1}`),
    description: coerceText(item?.description) || `line item ${index + 1}`,
    phase_name: coerceText(item?.phase_name) || coerceText(item?.name) || fallbackPhase,
    quantity: coerceNumber(item?.quantity || 1),
    unit: coerceText(item?.unit) || "each",
    unit_price: coerceNumber(item?.unit_price || item?.unitPrice),
    line_total: coerceNumber(item?.line_total || item?.total || item?.lineTotal || coerceNumber(item?.quantity || 1) * coerceNumber(item?.unit_price || item?.unitPrice)),
  }));
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
  let query = sb.from("contacts").select(CONTACT_SELECT_WITH_ACTIVITY);

  query = buildScopeQuery(query, scope);

  const initialResult = await query.order("created_at", { ascending: false }).limit(limit);
  let data: RootContactRow[] | null = (initialResult.data as RootContactRow[] | null) ?? null;
  let error = initialResult.error;
  if (isMissingColumnError(error, "last_activity")) {
    let fallbackQuery = sb.from("contacts").select(CONTACT_SELECT_FALLBACK);
    fallbackQuery = buildScopeQuery(fallbackQuery, scope);
    const fallbackResult = await fallbackQuery.order("created_at", { ascending: false }).limit(limit);
    data = (fallbackResult.data as RootContactRow[] | null) ?? null;
    error = fallbackResult.error;
  }

  return {
    contacts: (data || []).map((contact: RootContactRow): RootContactListRecord & RootContactRow => {
      const contactType = coerceText(contact.contact_type);
      const lifecycle = coerceText((contact as RootContactRow).lifecycle) || contactType || "customer";

      return {
        ...contact,
        id: String(contact.id || ""),
        name: coerceText(contact.name),
        full_name: coerceText(contact.full_name) || coerceText(contact.name) || "unnamed contact",
        lifecycle,
        contact_type: contactType,
        open_invoice_count: coerceNumber(contact.open_invoice_count),
        accepted_quotes: coerceNumber(contact.accepted_quotes),
        last_activity: coerceText(contact.last_activity) || coerceText(contact.last_contacted),
        segment: ["vendor", "supplier"].includes(lifecycle.toLowerCase()) ? "supplier" : "customer",
      };
    }),
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

  return {
    dossier: {
      ...contact,
      full_name: coerceText(contact.full_name) || coerceText(contact.name) || "unnamed contact",
      lifecycle: coerceText((contact as RootContactRow).lifecycle) || coerceText(contact.contact_type) || "customer",
      segment:
        ["vendor", "supplier"].includes(String(contact.contact_type || (contact as RootContactRow).lifecycle || "").toLowerCase())
          ? "supplier"
          : "customer",
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
    created_at: payment.created_at || null,
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
