import { hashEstimateVersionSnapshot } from "@/lib/os-estimate-versions";
/** Read-only CCO projection. Supply a route-admitted client; never initializes
 * credentials or writes. Permission checks here supplement route admission. */
export type CommercialReadAccess = {
    businessUnit: string;
    role: string;
    permissions: readonly string[];
};
type Row = Record<string, unknown>;
type ReadResult = {
    data: unknown;
    error: unknown;
    count: number | null;
};
export interface CommercialReadQuery extends PromiseLike<ReadResult> {
    select(columns: string, options: {
        count: "exact";
    }): CommercialReadQuery;
    eq(column: string, value: unknown): CommercialReadQuery;
    in(column: string, values: readonly string[]): CommercialReadQuery;
    limit(count: number): CommercialReadQuery;
}
export type CommercialReadClient = {
    from(table: string): CommercialReadQuery;
};
type Missing = {
    state: "absent" | "unavailable";
    reason: string;
};
type Evidence<T> = {
    state: "available";
    records: T[];
} | Missing;
type Version = {
    state: "available";
    estimateId: string;
    versionId: string;
    version: number;
    frozenAt: string;
    snapshotSha256: string;
    totalCents: number;
    depositDueCents: number;
    currency: string;
};
export type CommercialInvoiceStatus = {
    id: string;
    href: string;
    amountDueCents: number;
    amountPaidCents: number;
    balanceDueCents: number;
    recordedPaymentStatus: string;
    recordedDocumentStatus: string | null;
    recordedCompletedPaymentCents: number;
    ledgerReconciliation: "agrees" | "disagrees";
    providerConfirmation: "unavailable";
};
export type CommercialHandoffStatus = {
    receiptId: string;
    projectId: string;
    href: string;
    projectAccess: "unverified";
};
export type CommercialStatus = {
    state: "available" | "denied" | "not_found" | "unavailable";
    authority: "CCO_OS";
    projection: "read_only";
    quoteVersion: Version | Missing;
    invoices: Evidence<CommercialInvoiceStatus>;
    handoff: Evidence<CommercialHandoffStatus>;
    proposalLineage: Missing;
    nextAction: {
        kind: "inspect_invoice" | "inspect_recorded_project";
        href: string;
        label: string;
        reason: string;
    } | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId = (v: unknown): v is string => typeof v === "string" && uuid.test(v);
const cents = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const record = (v: unknown): v is Row => Boolean(v && typeof v === "object" && !Array.isArray(v));
const missing = (reason: string, state: Missing["state"] = "unavailable"): Missing => ({ state, reason });
function initial(state: CommercialStatus["state"], reason: string): CommercialStatus {
    return { state, authority: "CCO_OS", projection: "read_only", quoteVersion: missing(reason), invoices: missing(reason), handoff: missing(reason), proposalLineage: missing("No verified mapping from CCO estimate versions to proposal-package Operating Record lineage."), nextAction: null };
}
async function rows(query: CommercialReadQuery): Promise<Row[] | null> {
    try {
        const r = await query;
        return !r.error && Array.isArray(r.data) && r.data.every(record) && Number.isSafeInteger(r.count) && r.count === r.data.length ? r.data : null;
    }
    catch {
        return null;
    }
}
function version(row: Row, estimateId: string, versionId: string, quoteId: string): Version | null {
    if (row.id !== versionId || row.estimate_id !== estimateId || !Number.isSafeInteger(row.version) || Number(row.version) < 1 || typeof row.frozen_at !== "string" || !Number.isFinite(Date.parse(row.frozen_at)))
        return null;
    if (!record(row.snapshot) || typeof row.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.sha256))
        return null;
    const s = row.snapshot;
    if (s.frozen_at !== row.frozen_at || !record(s.estimate) || !Array.isArray(s.line_items) || !record(s.totals))
        return null;
    if (s.estimate.id !== estimateId || s.estimate.business_unit !== "CC" || s.estimate.legacy_quote_id !== quoteId)
        return null;
    try {
        if (hashEstimateVersionSnapshot(s) !== row.sha256)
            return null;
    }
    catch {
        return null;
    }
    const t = s.totals;
    if (![t.subtotal_cents, t.tax_cents, t.total_cents, t.deposit_due_cents, t.balance_remaining_cents].every(cents) || Number(t.subtotal_cents) + Number(t.tax_cents) !== t.total_cents || Number(t.deposit_due_cents) + Number(t.balance_remaining_cents) !== t.total_cents)
        return null;
    if (typeof t.deposit_percent !== "number" || !Number.isFinite(t.deposit_percent) || t.deposit_percent < 0 || t.deposit_percent > 100 || typeof t.currency !== "string" || !/^[A-Z]{3}$/.test(t.currency))
        return null;
    return { state: "available", estimateId, versionId, version: Number(row.version), frozenAt: row.frozen_at, snapshotSha256: row.sha256, totalCents: Number(t.total_cents), depositDueCents: Number(t.deposit_due_cents), currency: t.currency };
}
function handoff(r: Row, source: Row, v: Version): CommercialHandoffStatus | null {
    if (!isId(r.id) || r.estimate_id !== v.estimateId || r.estimate_version_id !== v.versionId || !isId(r.cvp_project_id) || !isId(r.cvp_inquiry_id) || !record(r.receipt))
        return null;
    const receipt = r.receipt;
    if (receipt.status !== "created" || receipt.estimateId !== v.estimateId || receipt.estimateVersionId !== v.versionId || receipt.cvpProjectId !== r.cvp_project_id || receipt.cvpInquiryId !== r.cvp_inquiry_id || receipt.idempotencyKey !== r.idempotency_key || receipt.payloadHash !== r.payload_hash || typeof r.payload_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(r.payload_hash) || !record(receipt.commercialRef))
        return null;
    const ref = receipt.commercialRef;
    const snapshot = source.snapshot as Row;
    const number = (snapshot.estimate as Row).estimate_number;
    if (typeof number !== "string" || !number.trim())
        return null;
    const prefix = `cco:${number.trim().toLowerCase()}:v${v.version}:`;
    if (typeof r.idempotency_key !== "string" || !r.idempotency_key.startsWith(prefix) || !/^[A-Z][A-Z0-9]{0,2}$/.test(r.idempotency_key.slice(prefix.length)))
        return null;
    if (ref.source !== "cco_os" || ref.estimate_id !== v.estimateId || ref.estimate_version_id !== v.versionId || ref.version !== v.version || ref.snapshot_sha256 !== v.snapshotSha256 || ref.frozen_at !== v.frozenAt || ref.estimate_number !== number || ref.idempotency_key !== r.idempotency_key || !record(ref.totals))
        return null;
    try {
        if (hashEstimateVersionSnapshot(ref.totals) !== hashEstimateVersionSnapshot(snapshot.totals))
            return null;
    }
    catch {
        return null;
    }
    return { receiptId: r.id, projectId: r.cvp_project_id, href: `https://co-videopro.com/projects/${encodeURIComponent(r.cvp_project_id)}`, projectAccess: "unverified" };
}
export async function readCommercialHandoffStatus(input: {
    quoteId: string;
    access: CommercialReadAccess;
}, deps: {
    sb: CommercialReadClient;
}): Promise<CommercialStatus> {
    const a = input.access;
    if (a.businessUnit !== "CC" || !["platform_owner", "platform_admin", "ops_admin", "finance_admin"].includes(a.role) || !a.permissions.includes("quote_read") || !a.permissions.includes("invoice_read") || !isId(input.quoteId))
        return initial("denied", "Commercial reader admission denied.");
    const sb = deps.sb;
    const out = initial("available", "Frozen authority unavailable.");
    const quotes = await rows(sb.from("quotes").select("id,business_unit", { count: "exact" }).eq("id", input.quoteId).eq("business_unit", "CC").limit(2));
    if (quotes === null || quotes.length > 1)
        return initial("unavailable", "Quote read unavailable.");
    if (!quotes.length || quotes[0].id !== input.quoteId || quotes[0].business_unit !== "CC")
        return initial("not_found", "CCO quote not found.");
    const es = await rows(sb.from("estimates").select("id,business_unit,legacy_quote_id,active_version_id", { count: "exact" }).eq("legacy_quote_id", input.quoteId).eq("business_unit", "CC").limit(2));
    if (es === null || es.length > 1) {
        out.quoteVersion = missing("Estimate bridge unavailable or ambiguous.");
        return out;
    }
    if (!es.length) {
        out.quoteVersion = missing("No CCO estimate bridge recorded.", "absent");
        return out;
    }
    const e = es[0];
    if (!isId(e.id) || e.business_unit !== "CC" || e.legacy_quote_id !== input.quoteId) {
        out.quoteVersion = missing("Invalid estimate binding.");
        return out;
    }
    if (e.active_version_id == null) {
        out.quoteVersion = missing("No frozen version recorded.", "absent");
        return out;
    }
    if (!isId(e.active_version_id)) {
        out.quoteVersion = missing("Invalid frozen version binding.");
        return out;
    }
    const vs = await rows(sb.from("estimate_versions").select("id,estimate_id,version,frozen_at,snapshot,sha256", { count: "exact" }).eq("id", e.active_version_id).eq("estimate_id", e.id).limit(2));
    const v = vs?.length === 1 ? version(vs[0], e.id, e.active_version_id, input.quoteId) : null;
    if (!v || !vs) {
        out.quoteVersion = missing("Frozen version integrity unavailable.");
        return out;
    }
    out.quoteVersion = v;
    const hs = await rows(sb.from("commercial_handoffs").select("id,estimate_id,estimate_version_id,idempotency_key,payload_hash,cvp_inquiry_id,cvp_project_id,receipt", { count: "exact" }).eq("estimate_id", e.id).eq("estimate_version_id", v.versionId).limit(21));
    if (hs === null || hs.length > 20)
        out.handoff = missing("Commercial receipt read unavailable.");
    else if (!hs.length)
        out.handoff = missing("No current-version handoff receipt recorded.", "absent");
    else {
        const rs = hs.map(r => handoff(r, vs[0], v));
        out.handoff = rs.every((r): r is CommercialHandoffStatus => r !== null) && new Set(rs.map(r => r?.receiptId)).size === rs.length ? { state: "available", records: rs } : missing("Invalid commercial receipt binding.");
    }
    const invoices = await rows(sb.from("invoices").select("id,business_unit,estimate_id,estimate_version_id,quote_id,invoice_type,amount_due_cents,amount_paid_cents,balance_due_cents,payment_status,document_status", { count: "exact" }).eq("business_unit", "CC").eq("estimate_id", e.id).eq("estimate_version_id", v.versionId).eq("invoice_type", "deposit").limit(21));
    if (invoices === null || invoices.length > 20)
        out.invoices = missing("Current-version invoice read unavailable.");
    else if (!invoices.length)
        out.invoices = missing("No current-version deposit invoice recorded.", "absent");
    else {
        const valid = invoices.every(i => isId(i.id) && i.business_unit === "CC" && i.estimate_id === e.id && i.estimate_version_id === v.versionId && i.quote_id === input.quoteId && i.invoice_type === "deposit" && cents(i.amount_due_cents) && cents(i.amount_paid_cents) && cents(i.balance_due_cents) && i.amount_due_cents === v.depositDueCents && Number(i.amount_paid_cents) + Number(i.balance_due_cents) === i.amount_due_cents && ["unpaid", "partial", "paid"].includes(String(i.payment_status)));
        if (!valid || new Set(invoices.map(i => i.id)).size !== invoices.length)
            out.invoices = missing("Invalid invoice monetary binding.");
        else {
            const ids = invoices.map(i => String(i.id));
            const ps = await rows(sb.from("payments").select("id,business_unit,invoice_id,estimate_id,amount_cents,currency,status", { count: "exact" }).eq("business_unit", "CC").eq("estimate_id", e.id).in("invoice_id", ids).limit(101));
            const validPayments = ps !== null && ps.length <= 100 && new Set(ps.map(p => p.id)).size === ps.length && ps.every(p => isId(p.id) && p.business_unit === "CC" && p.estimate_id === e.id && ids.includes(String(p.invoice_id)) && cents(p.amount_cents) && p.currency === v.currency && ["completed", "pending", "failed", "refunded", "cancelled"].includes(String(p.status)));
            if (!validPayments || !ps)
                out.invoices = missing("Invoice ledger read or integrity unavailable.");
            else {
                const rs: CommercialInvoiceStatus[] = invoices.map(i => {
                    const completed = ps.filter(p => p.invoice_id === i.id && p.status === "completed").reduce((sum, p) => sum + Number(p.amount_cents), 0);
                    return { id: String(i.id), href: `/os/invoices/${encodeURIComponent(String(i.id))}`, amountDueCents: Number(i.amount_due_cents), amountPaidCents: Number(i.amount_paid_cents), balanceDueCents: Number(i.balance_due_cents), recordedPaymentStatus: String(i.payment_status), recordedDocumentStatus: typeof i.document_status === "string" ? i.document_status : null, recordedCompletedPaymentCents: completed, ledgerReconciliation: completed === i.amount_paid_cents ? "agrees" : "disagrees", providerConfirmation: "unavailable" };
                });
                out.invoices = rs.every(i => cents(i.recordedCompletedPaymentCents)) ? { state: "available", records: rs } : missing("Ledger monetary total invalid.");
            }
        }
    }
    if (out.invoices.state === "available" && out.invoices.records.length === 1) {
        const i = out.invoices.records[0];
        if (i.balanceDueCents > 0 || i.ledgerReconciliation === "disagrees")
            out.nextAction = { kind: "inspect_invoice", href: i.href, label: "Inspect invoice", reason: "Inspect the recorded balance and ledger in CCO OS." };
    }
    const invoicesInspected = out.invoices.state === "absent" || (out.invoices.state === "available" && out.invoices.records.every(i => i.balanceDueCents === 0 && i.ledgerReconciliation === "agrees"));
    if (!out.nextAction && invoicesInspected && out.handoff.state === "available" && out.handoff.records.length === 1)
        out.nextAction = { kind: "inspect_recorded_project", href: out.handoff.records[0].href, label: "Inspect recorded project", reason: "The receipt records this ID; current project existence and your access remain unverified." };
    return out;
}
