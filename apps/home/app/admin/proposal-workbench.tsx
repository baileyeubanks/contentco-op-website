"use client";

import { useMemo, useState } from "react";
import type { CcoAppHandoff, CcoBrief, CcoEstimate, CcoEstimateLineItem, CcoPerson } from "@/lib/cco-admin-model";
import s from "./page.module.css";

type Props = {
  estimate: CcoEstimate;
  brief: CcoBrief;
  lead: CcoPerson;
  handoffs: CcoAppHandoff[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function lineTotal(item: CcoEstimateLineItem) {
  return item.quantity * item.unitPriceCents;
}

export function ProposalWorkbench({ estimate, brief, lead, handoffs }: Props) {
  const [scope, setScope] = useState(brief.projectName);
  const [lineItems, setLineItems] = useState(estimate.lineItems);
  const [assumptions, setAssumptions] = useState(estimate.assumptions.join("\n"));
  const [exclusions, setExclusions] = useState(estimate.exclusions.join("\n"));
  const [timeline, setTimeline] = useState(estimate.timeline);
  const [paymentTerms, setPaymentTerms] = useState(estimate.paymentTerms);
  const [internalNotes, setInternalNotes] = useState("Review enrichment before sending. Confirm discovery call notes and any travel requirements.");
  const [approvalStatus, setApprovalStatus] = useState(estimate.status);
  const [sendState] = useState("This legacy workbench cannot save or send estimates. Use the canonical CCO estimate workflow.");

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
    return {
      subtotal,
      deposit: Math.round(subtotal * (estimate.depositPercent / 100)),
    };
  }, [estimate.depositPercent, lineItems]);

  function updateLineItem(id: string, patch: Partial<CcoEstimateLineItem>) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        return { ...next, lineTotalCents: lineTotal(next) };
      }),
    );
  }

  return (
    <article className={s.workbench}>
      <div className={s.workbenchHeader}>
        <div>
          <p className={s.kicker}>Estimate / Proposal Workbench</p>
          <h2>{estimate.estimateNumber}</h2>
          <p>{lead.fullName} · {lead.email}</p>
        </div>
        <div className={s.totalBox}>
          <span>Total</span>
          <strong>{formatCurrency(totals.subtotal)}</strong>
          <small>{estimate.depositPercent}% deposit: {formatCurrency(totals.deposit)}</small>
        </div>
      </div>

      <div className={s.workbenchGrid}>
        <section className={s.editorPanel}>
          <label className={s.field}>
            <span>Editable scope</span>
            <input value={scope} onChange={(event) => setScope(event.target.value)} />
          </label>
          <div className={s.lineItems}>
            <div className={s.lineHeader}>
              <span>Line item</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Total</span>
            </div>
            {lineItems.map((item) => (
              <div className={s.lineRow} key={item.id}>
                <input
                  value={item.description}
                  onChange={(event) => updateLineItem(item.id, { description: event.target.value })}
                />
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={item.quantity}
                  onChange={(event) => updateLineItem(item.id, { quantity: Number(event.target.value || 0) })}
                />
                <input
                  min="0"
                  step="100"
                  type="number"
                  value={item.unitPriceCents / 100}
                  onChange={(event) => updateLineItem(item.id, { unitPriceCents: Number(event.target.value || 0) * 100 })}
                />
                <strong>{formatCurrency(lineTotal(item))}</strong>
              </div>
            ))}
          </div>
          <div className={s.editorColumns}>
            <label className={s.field}>
              <span>Assumptions</span>
              <textarea value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
            </label>
            <label className={s.field}>
              <span>Exclusions</span>
              <textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} />
            </label>
          </div>
          <div className={s.editorColumns}>
            <label className={s.field}>
              <span>Timeline</span>
              <input value={timeline} onChange={(event) => setTimeline(event.target.value)} />
            </label>
            <label className={s.field}>
              <span>Payment terms</span>
              <input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
            </label>
          </div>
          <label className={s.field}>
            <span>Internal notes</span>
            <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
          </label>
        </section>

        <aside className={s.reviewPanel}>
          <div className={s.readiness}>
            <span>Readiness score</span>
            <strong>{brief.readinessScore}%</strong>
            <div><i style={{ width: `${brief.readinessScore}%` }} /></div>
          </div>
          <label className={s.field}>
            <span>Approval status</span>
            <select value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as CcoEstimate["status"])}>
              <option value="draft">Draft</option>
              <option value="approval_pending">Approval pending</option>
              <option value="approved_to_send">Approved to send</option>
              <option value="sent">Sent</option>
            </select>
          </label>
          <div className={s.actionStack}>
            <button type="button" disabled title="Legacy Firebase draft writes are retired.">
              Draft save unavailable
            </button>
            <button type="button" disabled title="A durable, authorized CCO estimate is required before PDF export.">
              PDF export unavailable
            </button>
            <button
              type="button"
              disabled
              title="Legacy proposal email delivery is retired."
            >
              Client email unavailable
            </button>
          </div>
          <p className={s.sendState}>{sendState}</p>
          <div className={s.handoffStack}>
            <span>Next handoff packets</span>
            {handoffs.map((handoff) => (
              <div key={handoff.id}>
                <strong>{handoff.appLabel}</strong>
                <small>{handoff.status} · {handoff.payloadShape}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </article>
  );
}
