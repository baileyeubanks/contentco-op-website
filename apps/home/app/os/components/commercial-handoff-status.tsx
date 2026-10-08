"use client";
import React, { useEffect, useState } from "react";
import type { CommercialStatus } from "@/lib/cco-commercial-handoff-status";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function money(cents: number, currency: string) { return Number.isSafeInteger(cents) && cents >= 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100) : "Unavailable"; }
const nonnegativeCents = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function evidence(v: unknown, validator: (r: unknown) => boolean) {
    return object(v) && ((["absent", "unavailable"].includes(String(v.state)) && typeof v.reason === "string") || (v.state === "available" && Array.isArray(v.records) && v.records.length <= 20 && v.records.every(validator)));
}
function validVersion(v: unknown) {
    if (!object(v))
        return false;
    if (["absent", "unavailable"].includes(String(v.state)))
        return typeof v.reason === "string";
    return v.state === "available" && typeof v.estimateId === "string" && uuid.test(v.estimateId) && typeof v.versionId === "string" && uuid.test(v.versionId) && typeof v.version === "number" && Number.isSafeInteger(v.version) && v.version > 0 && typeof v.frozenAt === "string" && Number.isFinite(Date.parse(v.frozenAt)) && typeof v.snapshotSha256 === "string" && /^[0-9a-f]{64}$/.test(v.snapshotSha256) && nonnegativeCents(v.totalCents) && nonnegativeCents(v.depositDueCents) && Number(v.depositDueCents) <= Number(v.totalCents) && typeof v.currency === "string" && /^[A-Z]{3}$/.test(v.currency);
}
function validInvoice(v: unknown) {
    return object(v) && typeof v.id === "string" && uuid.test(v.id) && v.href === `/os/invoices/${encodeURIComponent(v.id)}` && [v.amountDueCents, v.amountPaidCents, v.balanceDueCents, v.recordedCompletedPaymentCents].every(nonnegativeCents) && Number(v.amountPaidCents) + Number(v.balanceDueCents) === v.amountDueCents && ["unpaid", "partial", "paid"].includes(String(v.recordedPaymentStatus)) && (v.recordedDocumentStatus === null || typeof v.recordedDocumentStatus === "string") && ["agrees", "disagrees"].includes(String(v.ledgerReconciliation)) && v.providerConfirmation === "unavailable";
}
function validHandoff(v: unknown) {
    return object(v) && typeof v.receiptId === "string" && uuid.test(v.receiptId) && typeof v.projectId === "string" && uuid.test(v.projectId) && v.href === `https://co-videopro.com/projects/${encodeURIComponent(v.projectId)}` && v.projectAccess === "unverified";
}
function validAction(v: unknown) {
    return v === null || (object(v) && ["inspect_invoice", "inspect_recorded_project"].includes(String(v.kind)) && typeof v.href === "string" && typeof v.label === "string" && typeof v.reason === "string");
}
/** Only this quote's response can enter the panel. An aborted result is discarded
 * even if a transport ignores AbortSignal or finishes while JSON is parsing. */
export async function fetchCommercialStatus(id: string, signal: AbortSignal, transport: typeof fetch = fetch): Promise<CommercialStatus | null> {
    if (!uuid.test(id) || signal.aborted)
        return null;
    try {
        const response = await transport(`/api/os/quotes/${encodeURIComponent(id)}/commercial-status`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
        if (!response.ok || signal.aborted)
            return null;
        const body: unknown = await response.json();
        if (signal.aborted || !object(body) || body.quoteId !== id || !object(body.status))
            return null;
        const s = body.status;
        if (s.state !== "available" || s.authority !== "CCO_OS" || s.projection !== "read_only" || !validVersion(s.quoteVersion) || !evidence(s.invoices, validInvoice) || !evidence(s.handoff, validHandoff) || !object(s.proposalLineage) || s.proposalLineage.state !== "unavailable" || typeof s.proposalLineage.reason !== "string" || !validAction(s.nextAction))
            return null;
        const status = s as unknown as CommercialStatus;
        if (status.nextAction && !inspectionLink(status))
            return null;
        return status;
    }
    catch {
        return null;
    }
}
function inspectionLink(status: CommercialStatus): string | null {
    const action = status.nextAction;
    if (!action)
        return null;
    if (action.kind === "inspect_invoice" && status.invoices.state === "available") {
        const i = status.invoices.records.find(i => uuid.test(i.id) && `/os/invoices/${encodeURIComponent(i.id)}` === action.href);
        return i ? `/os/invoices/${encodeURIComponent(i.id)}` : null;
    }
    if (action.kind === "inspect_recorded_project" && status.handoff.state === "available") {
        const h = status.handoff.records.find(h => uuid.test(h.projectId) && `https://co-videopro.com/projects/${encodeURIComponent(h.projectId)}` === action.href);
        return h ? `https://co-videopro.com/projects/${encodeURIComponent(h.projectId)}` : null;
    }
    return null;
}
export function CommercialHandoffStatusView({ status }: {
    status: CommercialStatus;
}) {
    const v = status.quoteVersion;
    const href = inspectionLink(status);
    return <section aria-label="Commercial handoff" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.5, overflowWrap: "anywhere" }}>
    <h2 style={{ fontSize: 15, margin: "0 0 10px", fontWeight: 600 }}>Commercial handoff</h2>
    {v.state === "available" ? <p style={{ margin: "0 0 10px" }}>Frozen quote v{v.version} · {money(v.totalCents, v.currency)} · deposit {money(v.depositDueCents, v.currency)}</p> : <p>{v.reason}</p>}
    <div style={{ display: "grid", gap: 8 }}>
      {status.invoices.state === "available" ? status.invoices.records.map(i => <div key={i.id}>
        <strong>Deposit invoice</strong> · recorded status: {i.recordedPaymentStatus}<br />
        {v.state === "available" && <>Recorded balance {money(i.balanceDueCents, v.currency)} · completed ledger {money(i.recordedCompletedPaymentCents, v.currency)}<br /></>}
        {i.ledgerReconciliation === "disagrees" && <span>Invoice and payment ledger disagree. Inspect the invoice.<br /></span>}
        <span style={{ color: "var(--muted)" }}>Provider confirmation unavailable</span>
      </div>) : <p style={{ margin: 0 }}>{status.invoices.reason}</p>}
      {status.handoff.state === "available" ? status.handoff.records.map(h => <div key={h.receiptId}><strong>Project receipt recorded</strong><br /><span style={{ color: "var(--muted)" }}>Current project existence and your access remain unverified.</span></div>) : <p style={{ margin: 0 }}>{status.handoff.reason}</p>}
      <p style={{ margin: 0, color: "var(--muted)" }}>Proposal lineage unavailable. No verified link to the project Operating Record.</p>
    </div>
    {href && <a href={href} style={{ display: "inline-block", marginTop: 12, color: "#0057ff", fontWeight: 600 }}>{status.nextAction?.kind === "inspect_invoice" ? "Inspect invoice" : "Inspect recorded project"} →</a>}
  </section>;
}
export function startCommercialStatusRead(quoteId: string, onResult: (status: CommercialStatus | null) => void, transport: typeof fetch = fetch) {
    const controller = new AbortController();
    let active = true;
    void fetchCommercialStatus(quoteId, controller.signal, transport).then(status => { if (active && !controller.signal.aborted)
        onResult(status); });
    return () => { active = false; controller.abort(); };
}
export function commercialStatusForQuote(result: {
    quoteId: string;
    status: CommercialStatus | null;
} | null, quoteId: string): CommercialStatus | null {
    return result?.quoteId === quoteId ? result.status : null;
}
export function CommercialHandoffStatusPanel({ quoteId }: {
    quoteId: string;
}) {
    const [result, setResult] = useState<{
        quoteId: string;
        status: CommercialStatus | null;
    } | null>(null);
    useEffect(() => startCommercialStatusRead(quoteId, status => setResult({ quoteId, status })), [quoteId]);
    // Render-time binding prevents previous data flashing before effect cleanup.
    if (!result || result.quoteId !== quoteId)
        return <p role="status">Reading commercial status…</p>;
    if (!result.status)
        return <p role="status">Commercial status unavailable. Open the quote or invoice record to inspect it.</p>;
    const status = commercialStatusForQuote(result, quoteId);
    return status ? <CommercialHandoffStatusView status={status}/> : <p role="status">Commercial status unavailable.</p>;
}
