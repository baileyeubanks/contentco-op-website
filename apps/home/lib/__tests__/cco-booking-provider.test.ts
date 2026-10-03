import { afterEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn() }));
vi.mock("googleapis", () => ({ google: { auth: { GoogleAuth: class {} }, calendar: () => ({ freebusy: { query: mocks.query }, events: { insert: mocks.insert } }) } }));
import { buildDiscoverySlots, createDiscoveryCalendarEvent, getDiscoveryAvailability } from "../cco-booking";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.useRealTimers(); });
function configure() { vi.stubEnv("CCO_DISCOVERY_CALENDAR_ID", "isolated"); vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/not-read/test.json"); }
describe("retired provider helpers fail closed", () => {
  test("missing credentials expose no preview slots as availability", async () => {
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
    expect(await getDiscoveryAvailability()).toMatchObject({ slots: [], calendar: { mode: "unavailable" } });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  test.each([{ calendars: {} }, { calendars: { isolated: { errors: [{ reason: "notFound" }] } } }, { calendars: { isolated: {} } }, { calendars: { isolated: { busy: [{ start: "invalid", end: "invalid" }] } } }])("HTTP200 missing/errored/malformed calendar stays unavailable", async (data) => {
    configure(); mocks.query.mockResolvedValue({ data });
    expect((await getDiscoveryAvailability()).slots).toEqual([]);
  });
  test("provider exception exposes no slots or sensitive provider message", async () => {
    configure(); mocks.query.mockRejectedValue(new Error("secret-token-detail"));
    expect(await getDiscoveryAvailability()).toMatchObject({ slots: [], calendar: { error: "google_calendar_freebusy_failed" } });
  });
  test("valid freebusy response suppresses conflicting candidate time", async () => {
    configure(); const slot = buildDiscoverySlots()[0];
    mocks.query.mockResolvedValue({ data: { calendars: { isolated: { busy: [{ start: slot.startsAt, end: slot.endsAt }] } } } });
    const result = await getDiscoveryAvailability();
    expect(result.slots[0].available).toBe(false);
    expect(result.slots[1].available).toBe(true);
  });
  test("Central office hours retain 10am across daylight-saving changes", () => {
    configure(); vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T18:00:00Z"));
    const before = buildDiscoverySlots()[0];
    expect(before.startsAt).toBe("2026-11-02T16:00:00.000Z");
    expect(before.label).toContain("10:00");
    vi.setSystemTime(new Date("2026-03-06T18:00:00Z"));
    expect(buildDiscoverySlots()[0].startsAt).toBe("2026-03-09T15:00:00.000Z");
  });
  test("retired direct Calendar insert cannot bypass the canonical rail", async () => {
    configure();
    expect(await createDiscoveryCalendarEvent({ name: "Test", email: "test@example.test", durationMinutes: 20, slotId: "test", startsAt: "test", endsAt: "test" })).toEqual({ ok: false, error: "canonical_booking_receipt_required", retryable: false });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
