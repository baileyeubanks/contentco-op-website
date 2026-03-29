import type { AgreementContext, AgreementSection } from "./index";

/**
 * Content Co-Op — Scope of Work (SOW) Template
 *
 * Covers: deliverables, timeline, revisions, IP, usage, payment, cancellation.
 */
export function getCcScopeOfWork(ctx: AgreementContext): AgreementSection[] {
  const clientRef = ctx.clientName || "the Client";
  const total = ctx.total
    ? ctx.total.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "the quoted amount";
  const deposit = ctx.total
    ? (ctx.total * 0.5).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "50% of the quoted amount";
  const validDate = ctx.validUntil
    ? new Date(ctx.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "14 days from the date of this quote";

  /* Build deliverables list from phases if available */
  let deliverablesText = "the deliverables described in the Scope & Pricing section above";
  if (ctx.phases && ctx.phases.length > 0) {
    const phaseList = ctx.phases
      .map((p) => {
        const itemList = p.items.map((i) => i.description).filter(Boolean).join(", ");
        return `${p.name}${itemList ? `: ${itemList}` : ""}`;
      })
      .join("; ");
    deliverablesText = phaseList;
  }

  return [
    {
      title: "Scope of Work Agreement",
      body: `This Scope of Work ("SOW") is entered into by Content Co-Op ("CC") and ${clientRef} ("Client") for the content production services described in this quote. This quote is valid until ${validDate}. By accepting, Client agrees to the terms outlined below.`,
    },
    {
      title: "Deliverables",
      body: `CC will produce and deliver the following: ${deliverablesText}. The total project value is ${total}. This SOW covers only the deliverables explicitly described. Any additional work, revisions beyond the included rounds, or scope changes require a written change order approved by both parties.`,
    },
    {
      title: "Timeline",
      body: `Production begins upon receipt of the deposit payment and all required materials from Client (brand assets, access credentials, briefing materials, etc.). CC will provide an estimated timeline upon project kickoff. Delays caused by late Client feedback or material delivery may extend the timeline proportionally.`,
    },
    {
      title: "Revisions",
      body: `Two (2) rounds of revisions are included in this quote. A revision round is defined as a single consolidated set of feedback provided in writing. Additional revision rounds will be billed at CC's standard hourly rate. Revision requests must be submitted within 7 business days of each deliverable review.`,
    },
    {
      title: "Payment Terms",
      body: `A 50% deposit of ${deposit} is due upon acceptance of this quote. The remaining balance is due upon delivery of final deliverables. Payment terms are Net 14 from invoice date. Late payments may be subject to a 1.5% monthly service charge after 30 days past due.`,
    },
    {
      title: "Intellectual Property",
      body: `Upon receipt of full and final payment, all intellectual property rights for the delivered work transfer to Client. Until payment is received in full, CC retains all rights to the produced content. Any pre-existing CC intellectual property (templates, frameworks, tools) remains the property of CC.`,
    },
    {
      title: "Usage Rights",
      body: `Content Co-Op reserves the right to use delivered work in its portfolio, case studies, and marketing materials. Client may request confidential treatment in writing, in which case CC will not publicly display the work.`,
    },
    {
      title: "Cancellation",
      body: `If Client cancels this project after acceptance, Client is responsible for payment of 100% of work already completed plus 25% of the remaining quoted amount. If CC is unable to complete the project, Client will be refunded for any undelivered work.`,
    },
    {
      title: "Acceptance",
      body: `By clicking "Accept Quote" or signing below, Client confirms that they have reviewed the scope of work, deliverables, and terms outlined in this agreement. This constitutes a binding agreement between Content Co-Op and Client.`,
    },
  ];
}
