import type { BookingInput } from "./cco-discovery-booking-rail";
export const BOOKING_SESSION_KEY = "cco-discovery-pending.v1";
export type PendingBooking = { request: BookingInput; slotId: string; label: string };
export type BookingResponse = { ok: boolean; bookingId?: string; receipt?: { meetUrl: string; startsAt: string }; error?: string };
export function createBookingSession(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, send: (input: BookingInput) => Promise<BookingResponse>) {
  let inFlight: Promise<BookingResponse> | null = null;
  function read(): PendingBooking | null {
    const raw = storage.getItem(BOOKING_SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PendingBooking;
    if (!saved?.request?.submissionId || !saved.request.email || !saved.request.name || !saved.request.startsAt || !saved.request.endsAt || !saved.slotId || !saved.label) throw new Error("pending_booking_corrupt");
    return saved;
  }
  function submit(input: Omit<BookingInput, "submissionId">, slot: { id: string; label: string }): Promise<BookingResponse> {
    const previous = read();
    const matches = previous && previous.request.name === input.name && previous.request.email === input.email && previous.request.startsAt === input.startsAt && previous.request.endsAt === input.endsAt;
    if (previous && !matches) return Promise.reject(new Error("pending_booking_requires_verification"));
    if (inFlight) return inFlight;
    const pending: PendingBooking = previous || { request: { ...input, submissionId: crypto.randomUUID() }, slotId: slot.id, label: slot.label };
    // This write happens before calling the provider, including a synchronous
    // double submit. Any failed/unknown attempt remains frozen across reloads.
    storage.setItem(BOOKING_SESSION_KEY, JSON.stringify(pending));
    inFlight = Promise.resolve().then(() => send(pending.request)).then((response) => {
      if (response.ok && response.bookingId && response.receipt?.meetUrl && response.receipt.startsAt) storage.removeItem(BOOKING_SESSION_KEY);
      return response;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }
  return { read, submit };
}
