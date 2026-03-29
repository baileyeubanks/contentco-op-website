/**
 * Agreement Template Engine
 *
 * Generates BU-specific service agreements / scope-of-work documents
 * by merging quote data into templates. Used by:
 *   - Share pages (Agreement tab)
 *   - PDF generation (agreement section)
 *   - Quote detail view (agreement preview)
 */

import { getAcsServiceAgreement } from "./acs-service-agreement";
import { getCcScopeOfWork } from "./cc-sow";

export interface AgreementContext {
  clientName: string;
  clientEmail?: string;
  clientCompany?: string;
  quoteNumber?: string;
  total: number;
  validUntil?: string;
  createdAt?: string;
  phases?: { name: string; items: { description: string; quantity: number; unitPrice: number }[] }[];
  terms?: { title: string; body: string }[];
  notes?: string;
}

export interface AgreementSection {
  title: string;
  body: string;
}

/**
 * Get the rendered agreement sections for a quote.
 */
export function getAgreementTemplate(
  businessUnit: string,
  context: AgreementContext,
): AgreementSection[] {
  const bu = String(businessUnit || "ACS").toUpperCase();
  if (bu === "CC") return getCcScopeOfWork(context);
  return getAcsServiceAgreement(context);
}

/**
 * Determine if a quote requires a full signature (vs click-to-accept).
 *
 * Industry standard:
 * - Click-to-accept is legally sufficient under ESIGN Act for most service work
 * - Full signature recommended for high-value contracts
 */
export function requiresSignature(total: number, businessUnit: string): boolean {
  const bu = String(businessUnit || "ACS").toUpperCase();
  const threshold = bu === "ACS" ? 2000 : 5000;
  return total >= threshold;
}

/**
 * Format a dollar amount for display in agreements.
 */
function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export { formatMoney };
