/**
 * Supabase quote → QuoteDocumentPayload bridge.
 *
 * Transforms a Supabase `quotes` row + `quote_items` rows into the
 * RenderRequest JSON shape that the Mac Mini FastAPI endpoint expects.
 *
 * Field names MUST match services/documents/models.py exactly.
 */

import type { RenderRequest } from "@/lib/blaze-documents";

/* ─── Supabase Row Shapes ─── */

export interface QuoteRow {
  id: string;
  quote_number?: number;
  contact_id?: string;
  business_id?: string;
  business_unit?: string;
  status?: string;
  internal_status?: string;
  client_status?: string;
  issue_date?: string;
  valid_until?: string;
  payment_terms?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  service_address?: string;
  estimated_total?: number;
  notes?: string;
  payload?: {
    doc?: {
      title?: string;
      reference?: string;
      payment_terms?: string;
      payment_note?: string;
      notes_terms?: string[];
      project?: { title?: string; meta?: string[]; summary?: string[] };
      bill_to?: { name?: string; company?: string; email?: string };
      phases?: Array<{
        title: string;
        scheduleLabel?: string;
        narrative?: string[];
        items?: Array<{ description: string; quantity: number; unit_price: number }>;
      }>;
      advisory?: unknown;
      source?: { brief_id?: string; trigger?: string };
    };
    items?: Array<{ description: string; quantity: number; unit_price: number }>;
  };
}

export interface QuoteItemRow {
  id: string;
  quote_id: string;
  sort_order?: number;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  phase_name?: string;
}

/* ─── Brand Defaults ─── */

const CC_SELLER = {
  legal_name: "Eubanks Marketing Inc. DBA Content Co-op",
  address_line1: "322 Wilcrest Dr.",
  address_line2: "Houston, Texas 77042",
  country: "United States",
  email: "bailey@contentco-op.com",
  phone: "",
  company_id: "",
  payment_handle: "Zelle Payments: bailey@contentco-op.com",
};

const ACS_SELLER = {
  legal_name: "Astro Cleanings LLC",
  address_line1: "Houston, TX",
  address_line2: "Houston, Texas",
  country: "United States",
  email: "caio@astrocleanings.com",
  phone: "",
  company_id: "",
  payment_handle: "Zelle, Venmo, Cash",
};

const CC_TERMS: Record<string, string> = {
  Payment: "50% deposit to reserve production. Balance due on final delivery. Net 15 terms.",
  Travel: "All travel, lodging, and per-diem costs are included unless noted. Travel outside metro Houston may require a change order.",
  "Revision Rounds": "Two rounds of revisions are included. Additional rounds at $150/hr.",
  "Usage & Licensing": "Deliverables are licensed for internal and external marketing use unless otherwise specified.",
  Confidentiality: "All project details remain confidential between parties.",
  Cancellation: "If cancelled within 48 hours of production, 25% kill fee applies to cover pre-production.",
  "Force Majeure": "Neither party is liable for delays caused by events outside reasonable control.",
};

const ACS_TERMS: Record<string, string> = {
  Payment: "50% deposit required to secure booking. Balance due upon completion.",
  "Service Guarantee": "If you are not satisfied with our service, we will re-clean the affected areas at no additional cost within 48 hours.",
  Cancellation: "Cancellations within 24 hours of scheduled service incur a 25% fee.",
  "Access & Safety": "Client must ensure safe access to all areas requiring service. Hazardous conditions may result in rescheduling.",
};

const CC_ACCEPTANCE = {
  seller_name: "Bailey R. Eubanks",
  seller_title: "Creative Director, Content Co-op",
};

const ACS_ACCEPTANCE = {
  seller_name: "Caio Gustin",
  seller_title: "President, Astro Cleanings",
};

/* ─── Builder ─── */

export function buildRenderPayload(
  quote: QuoteRow,
  items: QuoteItemRow[],
): RenderRequest {
  const bu = (quote.business_unit || "CC").toUpperCase();
  const isACS = bu === "ACS";
  const tenant = isACS ? "acs" : "cc";

  // Group items by phase_name (fallback: single "Service" phase)
  const phaseMap = new Map<string, QuoteItemRow[]>();
  const sortedItems = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const item of sortedItems) {
    const phaseName = item.phase_name || (isACS ? "Service" : "Production");
    if (!phaseMap.has(phaseName)) phaseMap.set(phaseName, []);
    phaseMap.get(phaseName)!.push(item);
  }

  // If we have doc.phases from the payload, use their schedule labels
  const docPhases = quote.payload?.doc?.phases || [];
  const phaseScheduleMap = new Map<string, string>();
  for (const dp of docPhases) {
    if (dp.title && dp.scheduleLabel) {
      phaseScheduleMap.set(dp.title, dp.scheduleLabel);
    }
  }

  const phases = Array.from(phaseMap.entries()).map(([name, phaseItems]) => ({
    name,
    date_label: phaseScheduleMap.get(name) || (quote.issue_date ? formatDate(quote.issue_date) : "TBD"),
    line_items: phaseItems.map((item) => ({
      name: item.name,
      description: item.description || "",
      quantity: item.quantity,
      price: item.unit_price,
    })),
  }));

  // Buyer info
  const billTo = quote.payload?.doc?.bill_to;
  const buyer = {
    name: billTo?.name || quote.client_name || "",
    email: billTo?.email || quote.client_email || "",
    company: billTo?.company || "",
  };

  // Notes
  const notes = quote.payload?.doc?.notes_terms || [
    isACS
      ? "Quote is valid for 7 days from issue date."
      : "Quote is valid for 14 days from issue date.",
    "Scheduling and availability are subject to confirmation.",
  ];

  // Acceptance
  const acceptance = {
    client_name: buyer.name,
    client_company: buyer.company,
    ...(isACS ? ACS_ACCEPTANCE : CC_ACCEPTANCE),
  };

  // Summary
  const total = phases.reduce(
    (sum, p) => sum + p.line_items.reduce((s, li) => s + li.quantity * li.price, 0),
    0,
  );

  const summary = isACS
    ? {
        deposit_note: "50% deposit required to secure booking",
        payment_methods: "Zelle, Venmo, Cash",
      }
    : {
        immediate_note: phases.length > 0 ? `Phase 1 Only — $${phases[0].line_items.reduce((s, li) => s + li.quantity * li.price, 0).toLocaleString()} for ${phases[0].name}` : "",
        immediate_detail: phases.length > 1 ? `Phases ${Array.from({ length: phases.length - 1 }, (_, i) => i + 2).join(" & ")} quoted for planning; schedule TBD.` : "",
      };

  return {
    tenant,
    document_type: "quote",
    quote_number: quote.quote_number || 0,
    ref_name: quote.payload?.doc?.reference || quote.client_name || "",
    issue_date: quote.issue_date ? formatDate(quote.issue_date) : formatDate(new Date().toISOString()),
    valid_until: quote.valid_until ? formatDate(quote.valid_until) : "",
    seller: isACS ? ACS_SELLER : CC_SELLER,
    buyer,
    phases,
    summary,
    terms: { sections: isACS ? ACS_TERMS : CC_TERMS },
    notes,
    acceptance,
  };
}

/* ─── Helpers ─── */

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}
