import { describe, expect, test, vi } from "vitest";
import { eventIdentity, reserveDiscovery, validateDirectBooking, type BookingInput, type BookingRecord, type BookingStore, type BookingProvider, type EventReceipt } from "../cco-discovery-booking-rail";
const input: BookingInput = { submissionId: "11111111-1111-4111-8111-111111111111", name: "Test Guest", email: "guest@example.test", startsAt: "2026-10-05T15:00:00.000Z", endsAt: "2026-10-05T15:20:00.000Z" };
const config = { calendarId: "isolated-test-calendar", organizerEmail: "owner@example.test" };
function fixture() {
  let saved: BookingRecord | null = null;
  let external: EventReceipt | null = null;
  const store: BookingStore = {
    claim: vi.fn(async (request: BookingInput, calendarId: string, organizerEmail: string, fingerprint: string): Promise<{ record: BookingRecord; fresh: boolean }> => {
      if (saved) return { record: structuredClone(saved), fresh: false };
      saved = { ...request, id: "22222222-2222-4222-8222-222222222222", calendarId, organizerEmail, fingerprint, state: "pending", receipt: null };
      return { record: structuredClone(saved), fresh: true };
    }),
    settle: vi.fn(async (_id, _fingerprint, receipt) => {
      if (!saved) throw new Error("missing");
      if (saved.state !== "confirmed") saved = { ...saved, state: receipt ? "confirmed" : "needs_reconcile", receipt };
      return structuredClone(saved);
    }),
  };
  function receipt(booking: BookingRecord, eventId: string): EventReceipt {
    return { eventId, bookingId: booking.id, startsAt: booking.startsAt, endsAt: booking.endsAt, organizerEmail: booking.organizerEmail, attendees: [booking.email, booking.organizerEmail], meetUrl: "https://meet.google.com/abc-defg-hij", htmlLink: "https://www.google.com/calendar/event?eid=test" };
  }
  const provider: BookingProvider = {
    available: vi.fn(async () => true), find: vi.fn(async () => external),
    insert: vi.fn(async (booking, eventId) => { external = receipt(booking, eventId); return external; }),
  };
  return { store, provider, getSaved: () => saved, setExternal: (value: EventReceipt) => { external = value; }, receipt };
}
describe("canonical direct discovery booking", () => {
  test("direct input does not require a brief and rejects invalid duration", () => {
    expect(validateDirectBooking(input)).toEqual(input);
    expect(validateDirectBooking({ ...input, endsAt: "2026-10-05T15:30:00Z" })).toBeNull();
  });
  test("durable claim precedes provider calls, confirms only a matching durable receipt, and replays without invites", async () => {
    const f = fixture();
    const first = await reserveDiscovery(input, config, f.store, f.provider, () => true);
    expect(first.ok).toBe(true);
    expect(f.getSaved()?.state).toBe("confirmed");
    expect(vi.mocked(f.store.claim).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.provider.insert).mock.invocationCallOrder[0]);
    expect(await reserveDiscovery(input, config, f.store, f.provider, () => true)).toMatchObject({ ok: true, replayed: true });
    expect(f.provider.insert).toHaveBeenCalledTimes(1);
  });
  test("DB claim failure never reaches provider", async () => {
    const f = fixture(); vi.mocked(f.store.claim).mockRejectedValue(new Error("db down"));
    expect(await reserveDiscovery(input, config, f.store, f.provider, () => true)).toMatchObject({ ok: false, error: "booking_claim_failed" });
    expect(f.provider.find).not.toHaveBeenCalled();
    expect(f.provider.insert).not.toHaveBeenCalled();
  });
  test("same key with another attendee conflicts without leaking the original receipt", async () => {
    const f = fixture(); await reserveDiscovery(input, config, f.store, f.provider, () => true);
    expect(await reserveDiscovery({ ...input, email: "other@example.test" }, config, f.store, f.provider, () => true)).toEqual({ ok: false, error: "booking_submission_conflict", retryable: false });
    expect(f.provider.insert).toHaveBeenCalledTimes(1);
  });
  test("busy calendar and provider authentication failures never create events", async () => {
    const f = fixture(); vi.mocked(f.provider.available).mockResolvedValue(false);
    expect(await reserveDiscovery(input, config, f.store, f.provider, () => true)).toMatchObject({ ok: false, error: "booking_needs_reconciliation" });
    expect(f.provider.insert).not.toHaveBeenCalled();
    expect(f.getSaved()?.state).toBe("needs_reconcile");
    const auth = fixture(); vi.mocked(auth.provider.find).mockRejectedValue(new Error("403"));
    expect((await reserveDiscovery(input, config, auth.store, auth.provider, () => true)).ok).toBe(false);
    expect(auth.provider.insert).not.toHaveBeenCalled();
  });
  test("lost insert acknowledgement reconciles the deterministic event without reissuing an invite", async () => {
    const f = fixture();
    vi.mocked(f.provider.insert).mockImplementationOnce(async (booking, eventId) => { f.setExternal(f.receipt(booking, eventId)); throw new Error("timeout after insert"); });
    expect((await reserveDiscovery(input, config, f.store, f.provider, () => true)).ok).toBe(false);
    expect(await reserveDiscovery(input, config, f.store, f.provider, () => true)).toMatchObject({ ok: true, replayed: true });
    expect(f.provider.insert).toHaveBeenCalledTimes(1);
  });
  test("lost durable receipt write does not confirm; retry recovers the existing event", async () => {
    const f = fixture(); vi.mocked(f.store.settle).mockRejectedValueOnce(new Error("DB disconnected"));
    expect((await reserveDiscovery(input, config, f.store, f.provider, () => true)).ok).toBe(false);
    expect(await reserveDiscovery(input, config, f.store, f.provider, () => true)).toMatchObject({ ok: true });
    expect(f.provider.insert).toHaveBeenCalledTimes(1);
  });
  test.each(["meet", "attendee", "organizer", "slot", "identity"])("rejects incomplete or mismatched %s receipt", async (kind) => {
    const f = fixture(); vi.mocked(f.provider.insert).mockImplementationOnce(async (booking, eventId) => {
      const r = f.receipt(booking, eventId);
      if (kind === "meet") r.meetUrl = "";
      if (kind === "attendee") r.attendees = [booking.email];
      if (kind === "organizer") r.organizerEmail = "wrong@example.test";
      if (kind === "slot") r.endsAt = "2026-10-05T15:30:00Z";
      if (kind === "identity") r.eventId = "wrong";
      f.setExternal(r); return r;
    });
    expect((await reserveDiscovery(input, config, f.store, f.provider, () => true)).ok).toBe(false);
    expect(f.getSaved()?.state).toBe("needs_reconcile");
  });
  test("pending replay with no acknowledged event never sends a duplicate", async () => {
    const f = fixture(); vi.mocked(f.provider.insert).mockRejectedValue(new Error("unknown insert"));
    await reserveDiscovery(input, config, f.store, f.provider, () => true);
    await reserveDiscovery(input, config, f.store, f.provider, () => true);
    expect(f.provider.insert).toHaveBeenCalledTimes(1);
    expect(f.getSaved()?.state).toBe("needs_reconcile");
    expect(eventIdentity("22222222-2222-4222-8222-222222222222")).toBe("cco22222222222242228222222222222222");
  });
});
