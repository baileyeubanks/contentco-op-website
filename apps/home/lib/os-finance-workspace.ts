import { getRootContacts, getRootFinance, getRootInvoices, type RootContactListRecord } from "@/lib/root-data";
import type { RootBusinessScope } from "@/lib/root-request-scope";

type FinanceAccountTemplate = {
  code: string;
  name: string;
  type: string;
  class: string;
  active: boolean;
  business_scope: "ALL" | "ACS" | "CC";
};

type FinanceRuleTemplate = {
  id: string;
  condition: string;
  match_text: string;
  target_account: string;
  business_scope: "ALL" | "ACS" | "CC";
  auto_apply: boolean;
  last_matched: string;
};

const ACCOUNT_TEMPLATES: FinanceAccountTemplate[] = [
  { code: "1000", name: "operating cash", type: "bank", class: "asset", active: true, business_scope: "ALL" },
  { code: "1100", name: "accounts receivable", type: "current asset", class: "asset", active: true, business_scope: "ALL" },
  { code: "1200", name: "undeposited funds", type: "current asset", class: "asset", active: true, business_scope: "ALL" },
  { code: "2000", name: "accounts payable", type: "current liability", class: "liability", active: true, business_scope: "ALL" },
  { code: "2100", name: "sales tax liability", type: "current liability", class: "liability", active: true, business_scope: "ALL" },
  { code: "3000", name: "owner equity", type: "equity", class: "equity", active: true, business_scope: "ALL" },
  { code: "4000", name: "creative services revenue", type: "revenue", class: "revenue", active: true, business_scope: "CC" },
  { code: "4100", name: "service revenue", type: "revenue", class: "revenue", active: true, business_scope: "ACS" },
  { code: "5000", name: "direct costs", type: "direct cost", class: "expense", active: true, business_scope: "ALL" },
  { code: "6000", name: "operating expenses", type: "expense", class: "expense", active: true, business_scope: "ALL" },
];

const RULE_TEMPLATES: FinanceRuleTemplate[] = [
  {
    id: "rule-stripe-payout",
    condition: "description contains",
    match_text: "stripe payout",
    target_account: "1000 · operating cash",
    business_scope: "ALL",
    auto_apply: true,
    last_matched: "2 days ago",
  },
  {
    id: "rule-card-fees",
    condition: "description contains",
    match_text: "processing fee",
    target_account: "6000 · operating expenses",
    business_scope: "ALL",
    auto_apply: false,
    last_matched: "6 days ago",
  },
  {
    id: "rule-acs-deposit",
    condition: "memo contains",
    match_text: "astrocleanings",
    target_account: "4100 · service revenue",
    business_scope: "ACS",
    auto_apply: true,
    last_matched: "today",
  },
  {
    id: "rule-cc-project",
    condition: "memo contains",
    match_text: "contentco-op",
    target_account: "4000 · creative services revenue",
    business_scope: "CC",
    auto_apply: true,
    last_matched: "yesterday",
  },
];

function matchesScope<T extends { business_scope: "ALL" | "ACS" | "CC" }>(rows: T[], scope: RootBusinessScope) {
  if (!scope) return rows;
  return rows.filter((row) => row.business_scope === "ALL" || row.business_scope === scope);
}

export async function getRootFinanceWorkspace(scope: RootBusinessScope = null) {
  const [financeRes, invoicesRes, contactsRes] = await Promise.all([
    getRootFinance(200, scope),
    getRootInvoices(200, scope),
    getRootContacts(400, scope),
  ]);

  const financeRows = financeRes.finance || [];
  const invoices = invoicesRes.invoices || [];
  const contacts: RootContactListRecord[] = contactsRes.contacts || [];

  const paidInvoices = invoices.filter((invoice) => String(invoice.payment_status || "").toLowerCase() === "paid");
  const unpaidInvoices = invoices.filter((invoice) => String(invoice.payment_status || "").toLowerCase() !== "paid");
  const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.next_action?.toLowerCase().includes("collect"));
  const paymentLinkMissing = unpaidInvoices.filter((invoice) => !invoice.stripe_payment_link);
  const taxLiability = invoices.reduce((sum, invoice) => sum + Number(invoice.tax || 0), 0);
  const supplierContacts = contacts.filter((contact) =>
    ["vendor", "supplier"].includes(String(contact.lifecycle || "").toLowerCase()),
  );

  const reconciliationQueue = [
    ...paidInvoices
      .filter((invoice) => String(invoice.reconciliation_status || "").toLowerCase() !== "settled")
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: "invoice paid not reconciled",
        label: invoice.invoice_number || `INV-${String(invoice.id).slice(0, 8).toUpperCase()}`,
        counterpart: invoice.contact_name || "unknown client",
        amount: Number(invoice.paid_amount || invoice.total || invoice.amount || 0),
        state: invoice.reconciliation_status || "pending",
        business_unit: invoice.business_unit || scope || "ALL",
      })),
    ...paymentLinkMissing.slice(0, 20).map((invoice) => ({
      id: `payment-${invoice.id}`,
      type: "payment setup blocked",
      label: invoice.invoice_number || `INV-${String(invoice.id).slice(0, 8).toUpperCase()}`,
      counterpart: invoice.contact_name || "unknown client",
      amount: Number(invoice.balance_due || invoice.total || invoice.amount || 0),
      state: "payment_missing",
      business_unit: invoice.business_unit || scope || "ALL",
    })),
    ...financeRows
      .filter((row) => row.source === "bank_statement")
      .slice(0, 20)
      .map((row) => ({
        id: `statement-${row.id}`,
        type: "imported transaction unmatched",
        label: String(row.description || row.id),
        counterpart: row.contact_name || "manual review",
        amount: Number(row.amount || 0),
        state: "needs_match",
        business_unit: row.business_unit || scope || "ALL",
      })),
  ];

  return {
    overview: {
      cash_in: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0),
      cash_out: 0,
      receivables_amount: unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0),
      receivables_count: unpaidInvoices.length,
      payables_amount: 0,
      payables_count: 0,
      unreconciled_count: reconciliationQueue.length,
      sales_tax_liability: Number(taxLiability.toFixed(2)),
      blocked_actions: paymentLinkMissing.length + overdueInvoices.length,
    },
    accounts: matchesScope(ACCOUNT_TEMPLATES, scope),
    rules: matchesScope(RULE_TEMPLATES, scope),
    reconciliation: reconciliationQueue,
    tax: {
      liability: Number(taxLiability.toFixed(2)),
      setup_status: taxLiability > 0 ? "review needed" : "not configured",
      filing_readiness: taxLiability > 0 ? "liability present" : "no filing setup",
    },
    payables: {
      bills: [],
      suppliers: supplierContacts.map((contact) => ({
        id: contact.id,
        name: contact.full_name || contact.name || "unnamed supplier",
        payable_state: contact.open_invoice_count ? "review" : "clear",
        last_payment: contact.last_activity || null,
      })),
      payment_status: "no bill workflow connected",
      approval_state: "manual review",
    },
    error: financeRes.error || invoicesRes.error || contactsRes.error || null,
  };
}
