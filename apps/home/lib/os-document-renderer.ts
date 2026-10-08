/**
 * CCO OS Document Renderer — Matches Bailey's SE Customer Story quote style
 * Self-contained in the monorepo. No dependency on standalone /os/ repo.
 */

import { getSupabase } from "@/lib/supabase";

// ── Types ──

interface DocumentData {
  kind: "quote" | "invoice";
  publicClient?: boolean;
  documentNumber: string;
  businessUnit: "ACS" | "CC";
  issueDate: string;
  secondaryDate: string;
  secondaryLabel: string;
  paymentTerms: string;
  projectTitle: string | null;
  projectMeta: string | null;
  from: { name: string; company: string; address: string; contact: string };
  billTo: { name: string; title: string | null; company: string | null; email: string | null; phone: string | null; address: string | null };
  items: { number: string; name: string; description: string; qty: number; unit: string; rate: number; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string[];
  paymentInstructions: string[];
}

// ── Brand Config ──

const BRAND = {
  ACS: {
    name: "Astro Cleanings",
    company: "Astro Cleaning Services LLC",
    address: "Houston, TX",
    phone: "(832) 752-1050",
    email: "service@astrocleanings.com",
    website: "astrocleanings.com",
    accent: "#1B4F72",
    logoUrl: "/brand/assets/acs/exports/logo-dark.png",
    logoHeight: "46px",
  },
  CC: {
    name: "Bailey R. Eubanks",
    company: "Content Co-Op / Eubanks Marketing Inc.",
    address: "322 Wilcrest Dr., Houston, TX 77042",
    phone: "(501) 351-5927",
    email: "service@contentco-op.com",
    website: "contentco-op.com",
    accent: "#1a3a5c",
    logoUrl: "/brand/assets/cco/exports/contentco-op-logo.png",
    logoHeight: "52px",
  },
};

// ── Data Loading ──

async function loadQuoteData(quoteId: string, strictCC = false): Promise<DocumentData> {
  const sb = getSupabase();
  let query = sb.from("quotes").select("id, business_unit, quote_number, payload, line_items, tax, notes, payment_terms, issue_date, created_at, valid_until, client_name, client_email, client_phone, service_address, total, estimated_total").eq("id", quoteId);
  if (strictCC) query = query.eq("business_unit", "CC");
  const { data: quote } = await query.single();
  if (!quote || (strictCC && quote.business_unit !== "CC")) throw new Error("not_found");

  const bu = (strictCC ? "CC" : String(quote.business_unit || "CC").toUpperCase()) as "ACS" | "CC";
  const brand = BRAND[bu];

  // Parse payload (rootDocument format)
  let payload: any = null;
  if (quote.payload) {
    try { payload = typeof quote.payload === "string" ? JSON.parse(quote.payload) : quote.payload; } catch { /* */ }
  }
  const rootDoc = payload?.rootDocument || payload || {};

  // Line items — prefer quote.line_items JSONB (richest source), fall back to rootDocument.lineItems
  let rawItems: any[] = [];
  if (Array.isArray(quote.line_items) && quote.line_items.length > 0) {
    rawItems = quote.line_items;
  } else if (typeof quote.line_items === "string") {
    try { rawItems = JSON.parse(quote.line_items); } catch { /* */ }
  }
  if (rawItems.length === 0 && Array.isArray(rootDoc.lineItems)) {
    rawItems = rootDoc.lineItems;
  }

  if (rawItems.length === 0) {
    const { data: related } = await sb.from("quote_items")
      .select("name, description, quantity, unit_price, subtotal")
      .eq("quote_id", quoteId).order("created_at", { ascending: true });
    rawItems = related || [];
  }

  const lineItems = rawItems.map((item: any, i: number) => {
    const rate = item.unit_price != null ? Number(item.unit_price) : item.unitPriceCents != null ? Number(item.unitPriceCents) / 100 : item.unit_price_cents != null ? Number(item.unit_price_cents) / 100 : Number(item.rate || 0);
    const amount = item.subtotal != null ? Number(item.subtotal) : item.line_total != null ? Number(item.line_total) : item.lineTotalCents != null ? Number(item.lineTotalCents) / 100 : item.line_total_cents != null ? Number(item.line_total_cents) / 100 : Number(item.amount || 0);
    return {
      number: String(i + 1).padStart(2, "0"),
      name: item.description || item.name || "",
      description: item.note || item.detail || "",
      qty: Number(item.quantity || item.qty || 1),
      unit: item.unit_label || item.unitLabel || item.unit || "ea",
      rate,
      amount: amount || rate * Number(item.quantity || item.qty || 1),
    };
  });

  const subtotal = lineItems.reduce((sum, it) => sum + it.amount, 0);
  const tax = Number(quote.tax || 0);

  // Terms — from rootDocument or payload
  const notes: string[] = [];
  const paymentInstructions: string[] = [];

  if (Array.isArray(rootDoc.terms)) {
    // Split terms from payment instructions
    for (const term of rootDoc.terms) {
      if (/payment|wire|ach|check|payable/i.test(term)) {
        paymentInstructions.push(term);
      } else {
        notes.push(term);
      }
    }
  }
  if (quote.notes && !notes.includes(quote.notes)) notes.push(quote.notes);

  if (paymentInstructions.length === 0) {
    const pt = quote.payment_terms || (bu === "ACS" ? "Due within 7 days" : "Net 30");
    paymentInstructions.push(`Payment due ${pt} from invoice date. Checks payable to Eubanks Marketing Inc.`);
    paymentInstructions.push(`For wire/ACH details, contact ${brand.email}`);
  }

  // Project title
  let projectTitle = rootDoc.title || null;
  let projectMeta: string | null = null;
  if (projectTitle) {
    // Remove date suffix like " (2026-03-16)" for cleaner display
    projectTitle = projectTitle.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, "");
  }
  if (rootDoc.intro) projectMeta = rootDoc.intro;

  // Issuer from rootDocument
  const issuer = rootDoc.issuer || {};
  const recipient = rootDoc.recipient || {};

  return {
    kind: "quote",
    publicClient: strictCC,
    documentNumber: quote.quote_number || `QT-${quoteId.slice(0, 8)}`,
    businessUnit: bu,
    issueDate: quote.issue_date || quote.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    secondaryDate: quote.valid_until || rootDoc.secondaryDateLabel?.replace(/^Valid until /, "") || "",
    secondaryLabel: "VALID UNTIL",
    paymentTerms: quote.payment_terms || "Net 30",
    projectTitle,
    projectMeta,
    from: {
      name: strictCC ? "Content Co-op" : issuer.name || brand.name,
      company: strictCC ? "Content Co-op" : issuer.company || brand.company,
      address: issuer.addressLines?.join(", ") || brand.address,
      contact: strictCC ? "service@contentco-op.com" : `${brand.phone} | ${brand.email}`,
    },
    billTo: {
      name: recipient.name || quote.client_name || "—",
      title: recipient.title || null,
      company: recipient.company || null,
      email: recipient.email || quote.client_email || null,
      phone: recipient.phone || quote.client_phone || null,
      address: quote.service_address || null,
    },
    items: lineItems,
    subtotal,
    tax,
    total: Number(quote.total || quote.estimated_total || subtotal + tax),
    notes,
    paymentInstructions,
  };
}

async function loadInvoiceData(invoiceId: string, strictCC = false): Promise<DocumentData> {
  const sb = getSupabase();
  let query = sb.from("invoices").select("id, business_unit, invoice_number, line_items, tax, created_at, due_date, due_at, client_name, client_company, client_email, client_phone, total, amount, notes").eq("id", invoiceId);
  if (strictCC) query = query.eq("business_unit", "CC");
  const { data: invoice } = await query.single();
  if (!invoice || (strictCC && invoice.business_unit !== "CC")) throw new Error("not_found");

  const bu = (strictCC ? "CC" : String(invoice.business_unit || "CC").toUpperCase()) as "ACS" | "CC";
  const brand = BRAND[bu];

  let rawItems: any[] = [];
  if (invoice.line_items) {
    try { rawItems = typeof invoice.line_items === "string" ? JSON.parse(invoice.line_items) : invoice.line_items; } catch { /* */ }
  }

  const lineItems = rawItems.map((item: any, i: number) => ({
    number: String(i + 1).padStart(2, "0"),
    name: item.description || item.name || "",
    description: item.note || item.detail || "",
    qty: Number(item.quantity || item.qty || 1),
    unit: item.unit_label || item.unit || "ea",
    rate: Number(item.unit_price ?? item.rate ?? ((item.unit_price_cents ?? item.unitPriceCents ?? 0) / 100)),
    amount: Number(item.subtotal ?? item.line_total ?? item.amount ?? ((item.line_total_cents ?? item.lineTotalCents ?? 0) / 100)),
  }));

  const subtotal = lineItems.reduce((sum, it) => sum + it.amount, 0);
  const tax = Number(invoice.tax || 0);

  return {
    kind: "invoice",
    publicClient: strictCC,
    documentNumber: invoice.invoice_number || `INV-${invoiceId.slice(0, 8)}`,
    businessUnit: bu,
    issueDate: invoice.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    secondaryDate: invoice.due_date || invoice.due_at?.slice(0, 10) || "",
    secondaryLabel: "DUE DATE",
    paymentTerms: "Net 30",
    projectTitle: null,
    projectMeta: null,
    from: { name: strictCC ? "Content Co-op" : brand.name, company: strictCC ? "Content Co-op" : brand.company, address: brand.address, contact: strictCC ? "service@contentco-op.com" : `${brand.phone} | ${brand.email}` },
    billTo: { name: invoice.client_name || "—", title: null, company: invoice.client_company || null, email: invoice.client_email || null, phone: invoice.client_phone || null, address: null },
    items: lineItems,
    subtotal,
    tax,
    total: Number(invoice.total || invoice.amount || subtotal + tax),
    notes: invoice.notes ? [invoice.notes] : [],
    paymentInstructions: [`Payment due Net 30 from invoice date. Checks payable to Eubanks Marketing Inc.`, `For wire/ACH details, contact ${brand.email}`],
  };
}

// ── Helpers ──

function fmtDate(d: string): string {
  if (!d) return "—";
  try { return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)); } catch { return d; }
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function h(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// ── Render ──

function render(doc: DocumentData): string {
  const b = BRAND[doc.businessUnit];
  const accent = b.accent;
  const kindLabel = doc.kind === "quote" ? "PRICE QUOTE" : "INVOICE";

  const rows = doc.items.map(it => `
    <tr>
      <td style="width:32px;font-weight:700;color:${accent};font-style:italic;padding:10px 6px;vertical-align:top;font-size:12px;">${h(it.number)}</td>
      <td style="padding:10px 6px;vertical-align:top;">
        <div style="font-weight:600;font-size:12px;color:#111;">${h(it.name)}</div>
        ${it.description ? `<div style="font-size:11px;color:#777;margin-top:1px;">${h(it.description)}</div>` : ""}
      </td>
      <td style="text-align:center;padding:10px 6px;font-size:12px;vertical-align:top;">${it.qty}</td>
      <td style="text-align:right;padding:10px 6px;font-size:12px;vertical-align:top;">${fmtMoney(it.rate)}</td>
      <td style="text-align:right;padding:10px 6px;font-size:12px;font-weight:600;vertical-align:top;">${fmtMoney(it.amount)}</td>
    </tr>`).join("");

  const termsList = doc.notes.filter(Boolean).map(n => `<li>${h(n)}</li>`).join("");
  const payLines = doc.paymentInstructions.filter(Boolean).map(l => `${h(l)}`).join("<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${h(doc.documentNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,system-ui,sans-serif;background:#e8e8e8;color:#222;line-height:1.45;-webkit-font-smoothing:antialiased;font-size:12px}
.page{max-width:780px;margin:24px auto;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,0.1);overflow:hidden}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
.bar{height:5px;background:linear-gradient(90deg,${accent},${accent}dd)}
.wrap{padding:36px 44px 28px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.logo img{height:${b.logoHeight};display:block}
.dtype{text-align:right}
.dtype-label{font-size:11px;font-weight:600;color:#666;letter-spacing:0.06em}
.dtype-num{font-size:18px;font-weight:700;color:#111;margin-top:1px}
hr.sep{border:none;border-top:1.5px solid #ddd;margin:12px 0}
.meta{display:flex;gap:40px;margin-bottom:20px}
.meta dt{font-size:9px;font-weight:600;color:#aaa;letter-spacing:0.08em;text-transform:uppercase}
.meta dd{font-size:12px;font-weight:600;color:#111;margin-top:1px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;padding:16px 20px;background:#f8f9fa;border:1px solid #eee;border-radius:4px}
.plbl{font-size:9px;font-weight:700;color:${accent};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px}
.pname{font-size:13px;font-weight:700;color:#111;margin-bottom:2px}
.pdet{font-size:11px;color:#555;line-height:1.55}
.banner{border-left:3px solid ${accent};padding:10px 14px;background:#f0f6f9;margin-bottom:18px;border-radius:0 3px 3px 0}
.banner-title{font-size:13px;font-weight:700;color:#111}
.banner-meta{font-size:11px;color:#666;margin-top:2px}
table.items{width:100%;border-collapse:collapse;margin-bottom:18px}
table.items thead th{font-size:9px;font-weight:700;color:#888;letter-spacing:0.07em;text-transform:uppercase;padding:8px 6px;border-bottom:2px solid #ddd;text-align:left}
table.items thead th:nth-child(n+3){text-align:right}
table.items thead th:nth-child(3){text-align:center}
table.items tbody tr{border-bottom:1px solid #f0f0f0}
table.items tbody tr:last-child{border-bottom:1px solid #ddd}
.totals{display:flex;justify-content:flex-end;margin-bottom:22px}
.totals-block{width:220px}
.trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#555}
.trow-total{background:${accent};color:#fff;padding:10px 14px;border-radius:3px;margin-top:6px;display:flex;justify-content:space-between;align-items:center}
.trow-total .tl{font-size:11px;font-weight:700;letter-spacing:0.06em}
.trow-total .tv{font-size:18px;font-weight:800}
.sec-heading{font-size:10px;font-weight:700;color:#111;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px}
.notes{margin-bottom:16px}
.notes ul{padding-left:18px;font-size:11px;color:#555;line-height:1.65}
.notes li{margin-bottom:1px}
.payment{margin-bottom:20px;font-size:11px;color:#555;line-height:1.6}
.ftr{border-top:1px solid #ddd;padding-top:16px;text-align:center}
.ftr-thanks{font-size:12px;font-style:italic;color:${accent};margin-bottom:6px}
.ftr-contact{font-size:10px;color:#aaa}
</style>
</head>
<body>
<div class="page">
<div class="bar"></div>
<div class="wrap">

<div class="hdr">
  <div class="logo">${doc.publicClient ? "Content Co-op" : `<img src="${h(b.logoUrl)}" alt="${h(doc.businessUnit === "CC" ? "Content Co-Op" : "Astro Cleanings")}"/>`}</div>
  <div class="dtype">
    <div class="dtype-label">${h(kindLabel)}</div>
    <div class="dtype-num">#${h(doc.documentNumber)}</div>
  </div>
</div>

<hr class="sep"/>

<dl class="meta">
  <div><dt>Issue Date</dt><dd>${h(fmtDate(doc.issueDate))}</dd></div>
  <div><dt>${h(doc.secondaryLabel)}</dt><dd>${h(fmtDate(doc.secondaryDate))}</dd></div>
  <div><dt>Payment Terms</dt><dd>${h(doc.paymentTerms)}</dd></div>
</dl>

<div class="parties">
  <div>
    <div class="plbl">From</div>
    <div class="pname">${h(doc.from.name)}</div>
    <div class="pdet">${h(doc.from.company)}<br/>${h(doc.from.address)}<br/>${h(doc.from.contact)}</div>
  </div>
  <div>
    <div class="plbl">Bill To</div>
    <div class="pname">${h(doc.billTo.name)}</div>
    <div class="pdet">${doc.billTo.title ? h(doc.billTo.title) + "<br/>" : ""}${doc.billTo.company ? h(doc.billTo.company) + "<br/>" : ""}${doc.billTo.email ? h(doc.billTo.email) : ""}${doc.billTo.phone ? "<br/>" + h(doc.billTo.phone) : ""}${doc.billTo.address ? "<br/>" + h(doc.billTo.address) : ""}</div>
  </div>
</div>

${doc.projectTitle ? `<div class="banner"><div class="banner-title">${h(doc.projectTitle)}</div>${doc.projectMeta ? `<div class="banner-meta">${h(doc.projectMeta)}</div>` : ""}</div>` : ""}

<table class="items">
<thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody>
</table>

<div class="totals"><div class="totals-block">
  <div class="trow"><span>Subtotal</span><span>${fmtMoney(doc.subtotal)}</span></div>
  <div class="trow"><span>Tax</span><span>${fmtMoney(doc.tax)}</span></div>
  <div class="trow-total"><span class="tl">TOTAL DUE</span><span class="tv">${fmtMoney(doc.total)}</span></div>
</div></div>

${termsList ? `<div class="notes"><div class="sec-heading">Notes &amp; Terms</div><ul>${termsList}</ul></div>` : ""}
${payLines ? `<div class="payment"><div class="sec-heading">Payment</div>${payLines}</div>` : ""}

<div class="ftr">
  <div class="ftr-thanks">Thank you for your business.</div>
  <div class="ftr-contact">${doc.publicClient ? "Content Co-op | service@contentco-op.com" : `${h(doc.businessUnit === "CC" ? "Content Co-Op" : "Astro Cleanings")} | ${h(b.website)} | ${h(b.phone)} | ${h(b.email)}`}</div>
</div>

</div>
</div>
</body>
</html>`;
}

// ── Public API ──

export async function renderQuoteHtml(quoteId: string, options: { businessUnit?: "CC" } = {}): Promise<string> {
  return render(await loadQuoteData(quoteId, options.businessUnit === "CC"));
}

export async function renderInvoiceHtml(invoiceId: string, options: { businessUnit?: "CC" } = {}): Promise<string> {
  return render(await loadInvoiceData(invoiceId, options.businessUnit === "CC"));
}

/** One strict CC loader for capability-authorized preview and PDF rendering. */
export async function loadClientDocumentData(kind: "quote" | "invoice", id: string) {
  return kind === "quote" ? loadQuoteData(id, true) : loadInvoiceData(id, true);
}
