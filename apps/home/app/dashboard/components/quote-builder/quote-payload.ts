"use client";

import type { BuyerInfo } from "./buyer-form";
import type { Phase } from "./phase-editor";
import type { TermsSection } from "./terms-editor";

export type BusinessUnit = "ACS" | "CC";

type QuotePayload = Record<string, any>;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitNotes(notes: string) {
  return notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildItems(phases: Phase[]) {
  return phases.flatMap((phase) =>
    phase.items
      .filter((item) => item.description.trim())
      .map((item) => ({
        phase_name: phase.name.trim() || "General",
        description: item.description.trim(),
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        unit: item.unit || "ea",
      })),
  );
}

export function getDefaultValidityDays(businessUnit: BusinessUnit) {
  return businessUnit === "ACS" ? 7 : 14;
}

export function getDefaultPaymentTerms(businessUnit: BusinessUnit) {
  return businessUnit === "ACS"
    ? "Due within 7 days of invoice. Zelle / check / bank transfer."
    : "50% deposit on acceptance. Balance on delivery. Net 14.";
}

export function getPayloadReference(payload: QuotePayload | null | undefined) {
  return cleanString(payload?.doc?.reference);
}

export function getPayloadNotes(payload: QuotePayload | null | undefined) {
  const notes = payload?.doc?.notes_terms;
  return Array.isArray(notes)
    ? notes.map((note) => cleanString(note)).filter(Boolean).join("\n")
    : "";
}

export function getPayloadTerms(
  payload: QuotePayload | null | undefined,
  fallback: TermsSection[],
) {
  const sections = payload?.doc?.terms_sections;
  if (!Array.isArray(sections)) return fallback;

  const normalized = sections
    .map((section) => ({
      title: cleanString(section?.title),
      body: cleanString(section?.body),
    }))
    .filter((section) => section.title || section.body);

  return normalized.length > 0 ? normalized : fallback;
}

export function getPayloadBuyer(payload: QuotePayload | null | undefined) {
  const billTo = payload?.doc?.bill_to;
  return {
    name: cleanString(billTo?.name),
    email: cleanString(billTo?.email),
    phone: cleanString(billTo?.phone),
    company: cleanString(billTo?.company),
    address: cleanString(billTo?.address),
  } satisfies Partial<BuyerInfo>;
}

export function getPayloadPhaseScheduleMap(payload: QuotePayload | null | undefined) {
  const phaseMap = new Map<string, string>();
  const phases = payload?.doc?.phases;

  if (!Array.isArray(phases)) return phaseMap;

  for (const phase of phases) {
    const title = cleanString(phase?.title);
    const scheduleLabel = cleanString(phase?.scheduleLabel);
    if (title && scheduleLabel) {
      phaseMap.set(title, scheduleLabel);
    }
  }

  return phaseMap;
}

interface BuildQuoteMutationArgs {
  businessUnit: BusinessUnit;
  buyer: BuyerInfo;
  phases: Phase[];
  terms: TermsSection[];
  notes: string;
  referenceName: string;
  issueDate?: string;
  validUntil?: string;
  internalStatus?: string;
  clientStatus?: string;
  existingPayload?: QuotePayload | null;
}

export function buildQuoteMutation({
  businessUnit,
  buyer,
  phases,
  terms,
  notes,
  referenceName,
  issueDate,
  validUntil,
  internalStatus,
  clientStatus,
  existingPayload,
}: BuildQuoteMutationArgs) {
  const items = buildItems(phases);
  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
    0,
  );

  const payload = {
    ...(existingPayload || {}),
    doc: {
      ...(existingPayload?.doc || {}),
      reference: cleanString(referenceName) || undefined,
      payment_terms: getDefaultPaymentTerms(businessUnit),
      notes_terms: splitNotes(notes),
      terms_sections: terms
        .map((section) => ({
          title: cleanString(section.title),
          body: cleanString(section.body),
        }))
        .filter((section) => section.title || section.body),
      bill_to: {
        ...(existingPayload?.doc?.bill_to || {}),
        name: cleanString(buyer.name) || undefined,
        email: cleanString(buyer.email) || undefined,
        phone: cleanString(buyer.phone) || undefined,
        company: cleanString(buyer.company) || undefined,
        address: cleanString(buyer.address) || undefined,
      },
      phases: phases.map((phase) => ({
        title: cleanString(phase.name) || "General",
        scheduleLabel: cleanString(phase.date_label) || undefined,
        items: phase.items
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            unit: item.unit || "ea",
          })),
      })),
    },
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit: item.unit,
    })),
  };

  return {
    client_name: cleanString(buyer.name) || null,
    client_email: cleanString(buyer.email) || null,
    client_phone: cleanString(buyer.phone) || null,
    service_address: cleanString(buyer.address) || null,
    business_unit: businessUnit,
    estimated_total: estimatedTotal,
    issue_date: cleanString(issueDate) || null,
    valid_until: cleanString(validUntil) || null,
    payment_terms: payload.doc.payment_terms,
    internal_status: internalStatus,
    client_status: clientStatus,
    notes: cleanString(notes) || null,
    payload,
    items,
  };
}
