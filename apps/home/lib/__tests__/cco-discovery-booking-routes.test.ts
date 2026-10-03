import { afterEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ runtime: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/cco-discovery-booking-runtime", () => ({ discoveryRuntime: mocks.runtime }));
vi.mock("@/lib/cco-discovery-booking-rail", async (original) => ({ ...await original<typeof import("../cco-discovery-booking-rail")>(), reserveDiscovery: mocks.reserve }));
import { GET } from "@/app/api/cco/bookings/availability/route";
import { POST } from "@/app/api/cco/bookings/route";
afterEach(() => { vi.resetAllMocks(); });
function runtime() { return { availability: vi.fn(async () => []), config: { calendarId: "isolated", organizerEmail: "owner@example.test" }, store: {}, provider: {} }; }
function request(body: unknown, origin = "https://contentco-op.com") { return new Request("https://contentco-op.com/api/cco/bookings", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) }); }
describe("direct booking public contract", () => {
  test("production POST requires exactly a Request parameter", () => {
    type Parameter = Parameters<typeof POST>[0];
    type ExactRequest = [Parameter] extends [Request] ? [Request] extends [Parameter] ? true : false : false;
    const matches: ExactRequest = true;
    expect(matches).toBe(true);
  });
  test("unverified runtime stays visibly unavailable", async () => {
    mocks.runtime.mockResolvedValue(null);
    expect((await GET()).status).toBe(503);
    expect((await POST(request({}))).status).toBe(503);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  test("provider availability is returned without caching", async () => {
    const r = runtime(); mocks.runtime.mockResolvedValue(r);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, slots: [], durationMinutes: 20 });
  });
  test("direct booking accepts identity and time without any brief", async () => {
    mocks.runtime.mockResolvedValue(runtime());
    mocks.reserve.mockResolvedValue({ ok: true, bookingId: "test-booking", receipt: { meetUrl: "https://meet.google.com/abc-defg-hij" } });
    const response = await POST(request({ submissionId: "11111111-1111-4111-8111-111111111111", name: "Test Guest", email: "guest@example.test", startsAt: "2026-10-05T15:00:00Z", endsAt: "2026-10-05T15:20:00Z" }));
    expect(response.status).toBe(200);
    expect(mocks.reserve.mock.calls[0][0]).not.toHaveProperty("briefId");
    expect(await response.json()).toMatchObject({ ok: true, bookingId: "test-booking" });
  });
  test("partial outcome reports 503 and booking reference, never success", async () => {
    mocks.runtime.mockResolvedValue(runtime());
    mocks.reserve.mockResolvedValue({ ok: false, error: "booking_needs_reconciliation", retryable: true, bookingId: "test-booking" });
    const response = await POST(request({ submissionId: "11111111-1111-4111-8111-111111111111", name: "Test Guest", email: "guest@example.test", startsAt: "2026-10-05T15:00:00Z", endsAt: "2026-10-05T15:20:00Z" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, bookingId: "test-booking" });
  });
  test("bad origin and malformed payload never reserve", async () => {
    mocks.runtime.mockResolvedValue(runtime());
    expect((await POST(request({}, "https://invalid.example"))).status).toBe(403);
    expect((await POST(request(null))).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
