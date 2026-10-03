import { createHash } from "node:crypto";

export const BOOKING_CONTRACT = "cco.discovery-booking.v1";
export type BookingInput = { submissionId: string; name: string; email: string; startsAt: string; endsAt: string };
export type AcceptanceScope = { calendarId: string; organizerEmail: string; guestEmail: string; submissionId: string };
export type BookingConfig = { calendarId: string; organizerEmail: string; acceptanceScope?: AcceptanceScope | null };
export type BookingRecord = BookingInput & { id: string; calendarId: string; organizerEmail: string; fingerprint: string; state: "pending" | "confirmed" | "needs_reconcile"; receipt: EventReceipt | null };
export type EventReceipt = { eventId: string; startsAt: string; endsAt: string; organizerEmail: string; attendees: string[]; meetUrl: string; htmlLink: string; bookingId: string };
export interface BookingStore {
  claim(input: BookingInput, calendarId: string, organizerEmail: string, fingerprint: string, isOffered: boolean): Promise<{ record: BookingRecord; fresh: boolean }>;
  settle(id: string, fingerprint: string, receipt: EventReceipt | null): Promise<BookingRecord>;
}
export interface BookingProvider {
  available(startsAt: string, endsAt: string): Promise<boolean>;
  find(eventId: string): Promise<EventReceipt | null>;
  insert(record: BookingRecord, eventId: string): Promise<EventReceipt>;
}
export function eventIdentity(id: string) { return `cco${id.replaceAll("-", "")}`; }
export function validateDirectBooking(body: Record<string, unknown>): BookingInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const start = Date.parse(String(body.startsAt || ""));
  const end = Date.parse(String(body.endsAt || ""));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) || name.length < 2 || name.length > 160 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || !Number.isFinite(start) || !Number.isFinite(end) || end - start !== 20 * 60_000) return null;
  return { submissionId, name, email, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}
export function receiptMatches(record: BookingRecord, receipt: EventReceipt): boolean {
  const attendees = receipt.attendees.map((email) => email.toLowerCase()).sort();
  const expected = [...new Set([record.email, record.organizerEmail])].sort();
  return receipt.eventId === eventIdentity(record.id) && receipt.bookingId === record.id && Date.parse(receipt.startsAt) === Date.parse(record.startsAt) && Date.parse(receipt.endsAt) === Date.parse(record.endsAt) && receipt.organizerEmail.toLowerCase() === record.organizerEmail && JSON.stringify(attendees) === JSON.stringify(expected) && /^https:\/\/meet\.google\.com\/[a-z-]+$/.test(receipt.meetUrl) && /^https:\/\/(www\.)?google\.com\/calendar\//.test(receipt.htmlLink);
}
/** The provider and CCO-DB cannot share a transaction. Reserve durably first;
 * retain uncertain claims, reconcile by event ID, and never blindly reinsert. */
export async function reserveDiscovery(input: BookingInput, config: BookingConfig, store: BookingStore, provider: BookingProvider, slotIsOffered: (input: BookingInput) => boolean = () => false) {
  const scope = config.acceptanceScope;
  const scopeMatches = (request: BookingInput, calendarId: string, organizerEmail: string) => scope === undefined || (scope !== null && request.email === scope.guestEmail && request.submissionId.toLowerCase() === scope.submissionId && calendarId === scope.calendarId && organizerEmail === scope.organizerEmail);
  if (!scopeMatches(input, config.calendarId, config.organizerEmail)) return { ok: false as const, error: "booking_acceptance_scope_mismatch", retryable: false };
  // Acceptance policy is not part of canonical booking identity; changing that
  // optional guard must preserve the existing same-key receipt and fingerprint.
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...input, calendarId: config.calendarId, organizerEmail: config.organizerEmail })).digest("hex");
  let claim: { record: BookingRecord; fresh: boolean };
  try { claim = await store.claim(input, config.calendarId, config.organizerEmail, fingerprint, slotIsOffered(input)); }
  catch { return { ok: false as const, error: "booking_claim_failed", retryable: false }; }
  const record = claim.record;
  // Check returned canonical identity before confirmed replay or provider access.
  if (!scopeMatches(record, record.calendarId, record.organizerEmail)) return { ok: false as const, error: "booking_acceptance_scope_mismatch", retryable: false };
  if (record.fingerprint !== fingerprint) return { ok: false as const, error: "booking_submission_conflict", retryable: false };
  if (record.state === "confirmed" && record.receipt && receiptMatches(record, record.receipt)) return { ok: true as const, bookingId: record.id, receipt: record.receipt, replayed: true };
  try {
    let receipt = await provider.find(eventIdentity(record.id));
    if (!receipt) {
      // A replay may be concurrent with an insert or follow a lost response.
      // It may reconcile a known event, but never send a second invitation.
      if (!claim.fresh) throw new Error("reconciliation_required");
      if (!slotIsOffered(input)) throw new Error("slot_not_offered");
      if (!await provider.available(record.startsAt, record.endsAt)) throw new Error("slot_unavailable");
      await provider.insert(record, eventIdentity(record.id));
      receipt = await provider.find(eventIdentity(record.id));
      if (!receipt) throw new Error("event_readback_missing");
    }
    if (!receiptMatches(record, receipt)) throw new Error("receipt_incomplete");
    const saved = await store.settle(record.id, fingerprint, receipt);
    if (!scopeMatches(saved, saved.calendarId, saved.organizerEmail)) throw new Error("booking_acceptance_scope_mismatch");
    if (saved.state !== "confirmed" || !saved.receipt || !receiptMatches(saved, saved.receipt)) throw new Error("receipt_not_durable");
    return { ok: true as const, bookingId: saved.id, receipt: saved.receipt, replayed: !claim.fresh };
  } catch {
    try { await store.settle(record.id, fingerprint, null); } catch { /* Existing claim remains pending; never release uncertain time. */ }
    return { ok: false as const, error: "booking_needs_reconciliation", retryable: true, bookingId: record.id };
  }
}
