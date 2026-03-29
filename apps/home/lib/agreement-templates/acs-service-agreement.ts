import type { AgreementContext, AgreementSection } from "./index";

/**
 * Astro Cleaning Services — Service Agreement Template
 *
 * Covers: service scope, payment terms, cancellation, liability, access.
 */
export function getAcsServiceAgreement(ctx: AgreementContext): AgreementSection[] {
  const clientRef = ctx.clientName || "the Client";
  const total = ctx.total
    ? ctx.total.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "the quoted amount";
  const validDate = ctx.validUntil
    ? new Date(ctx.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "7 days from the date of this quote";

  return [
    {
      title: "Service Agreement",
      body: `This quote is presented by Astro Cleaning Services ("ACS") to ${clientRef} ("Client") for the cleaning and maintenance services described in the Scope & Pricing section above. This quote is valid until ${validDate}. By accepting this quote, Client agrees to the terms outlined below.`,
    },
    {
      title: "Scope of Services",
      body: `ACS will perform the services as described in the line items above, totaling ${total}. Any additional services requested beyond the scope of this quote will require a separate agreement or change order approved by both parties.`,
    },
    {
      title: "Payment Terms",
      body: `Payment of ${total} is due within 7 days of invoice. Accepted payment methods include Zelle, check, or bank transfer. Late payments may be subject to a 1.5% monthly service charge after 30 days past due.`,
    },
    {
      title: "Scheduling & Access",
      body: `Client agrees to provide reasonable access to the service location at the scheduled time. If ACS is unable to access the premises at the scheduled time due to Client action or inaction, a trip charge may apply. Rescheduling requests must be made at least 24 hours in advance.`,
    },
    {
      title: "Cancellation Policy",
      body: `Cancellations made with less than 24 hours' notice are subject to a 50% cancellation fee of the scheduled service amount. Cancellations made more than 24 hours in advance will not incur any charges.`,
    },
    {
      title: "Liability & Insurance",
      body: `Astro Cleaning Services maintains general liability insurance coverage for all work performed. ACS shall not be held liable for pre-existing damage, normal wear and tear, or damage resulting from structural or mechanical deficiencies at the service location. Any claims must be reported within 48 hours of service completion.`,
    },
    {
      title: "Acceptance",
      body: `By clicking "Accept Quote" or signing below, Client confirms that they have read and agree to the scope of work and terms outlined in this agreement. This constitutes a binding service agreement between ACS and Client.`,
    },
  ];
}
