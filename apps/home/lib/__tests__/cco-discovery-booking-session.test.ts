import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { BOOKING_SESSION_KEY, createBookingSession, type BookingResponse } from "../cco-discovery-booking-session";
import type { BookingInput } from "../cco-discovery-booking-rail";
import { DiscoveryBookingForm } from "@/app/book/booking-client";
const request = { name: "Test Guest", email: "guest@example.test", startsAt: "2026-10-05T15:00:00Z", endsAt: "2026-10-05T15:20:00Z" };
const slot = { id: "exact-slot", label: "Monday at 10:00 AM" };
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
describe("pending direct-booking browser session", () => {
  test("persists before POST and restores exact scope/key after transport unknown and reload", async () => {
    const saved = storage();
    const transport = vi.fn(async () => { expect(saved.getItem(BOOKING_SESSION_KEY)).not.toBeNull(); throw new Error("lost response"); });
    const first = createBookingSession(saved, transport);
    await expect(first.submit(request, slot)).rejects.toThrow("lost response");
    const pending = first.read();
    expect(pending?.request).toMatchObject(request);
    const retry = vi.fn(async (_input: BookingInput) => { void _input; return { ok: false, error: "booking_needs_reconciliation" }; });
    const reloaded = createBookingSession(saved, retry);
    expect(reloaded.read()).toEqual(pending);
    await reloaded.submit(request, slot);
    expect(retry.mock.calls[0][0].submissionId).toBe(pending?.request.submissionId);
    await expect(reloaded.submit({ ...request, startsAt: "2026-10-05T16:00:00Z" }, slot)).rejects.toThrow("pending_booking_requires_verification");
    expect(retry).toHaveBeenCalledTimes(1);
  });
  test("synchronous double submit invokes one transport with one request identity", async () => {
    const saved = storage(); let resolve!: (value: BookingResponse) => void;
    const transport = vi.fn(() => new Promise<BookingResponse>((done) => { resolve = done; }));
    const session = createBookingSession(saved, transport);
    const first = session.submit(request, slot);
    const second = session.submit(request, slot);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(1);
    resolve({ ok: false }); await first;
    expect(session.read()).not.toBeNull();
  });
  test("only complete canonical confirmation releases the pending request", async () => {
    const saved = storage(); const transport = vi.fn(async (): Promise<BookingResponse> => ({ ok: true }));
    const session = createBookingSession(saved, transport);
    await session.submit(request, slot); expect(session.read()).not.toBeNull();
    transport.mockResolvedValue({ ok: true, bookingId: "canonical", receipt: { meetUrl: "https://meet.google.com/abc-defg-hij", startsAt: request.startsAt } });
    await session.submit(request, slot); expect(session.read()).toBeNull();
  });
  test("failed local persistence never invokes transport", () => {
    const saved = storage(); saved.setItem = () => { throw new Error("storage denied"); };
    const transport = vi.fn(); const session = createBookingSession(saved, transport);
    expect(() => session.submit(request, slot)).toThrow("storage denied"); expect(transport).not.toHaveBeenCalled();
  });
  test("rendered reload verification form preserves exact identity and freezes selection even when availability hides the slot", () => {
    const html = renderToStaticMarkup(createElement(DiscoveryBookingForm, { slots: [{ ...slot, startsAt: request.startsAt, endsAt: request.endsAt, durationMinutes: 20, available: false, source: "pending_verification" }], selected: slot.id, name: request.name, email: request.email, frozen: true, sending: false, message: "Previous request needs verification", onSelect: vi.fn(), onName: vi.fn(), onEmail: vi.fn(), onSubmit: vi.fn() }));
    expect(html).toContain('value="exact-slot"');
    expect(html).toContain('checked=""'); expect(html).toContain('disabled=""');
    expect(html).toContain('value="Test Guest"'); expect(html).toContain('value="guest@example.test"');
    expect(html.match(/readOnly=""/g)).toHaveLength(2);
    expect(html).toContain("Verify this booking request");
  });
});
