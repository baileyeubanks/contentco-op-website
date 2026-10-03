import { afterEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), calendar: vi.fn(), metadata: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("googleapis", () => ({ google: { auth: { GoogleAuth: class {} }, calendar: mocks.calendar } }));
import { discoveryRuntime } from "../cco-discovery-booking-runtime";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const scope = { calendarId: "isolated-test-calendar", organizerEmail: "owner@example.test", guestEmail: "guest@example.test", submissionId: "11111111-1111-4111-8111-111111111111" };
function configure() {
  vi.stubEnv("CCO_DISCOVERY_BOOKING_CONTRACT", "cco.discovery-booking.v1");
  vi.stubEnv("CCO_DISCOVERY_CALENDAR_ID", scope.calendarId);
  vi.stubEnv("CCO_DISCOVERY_ORGANIZER_EMAIL", scope.organizerEmail);
  vi.stubEnv("CCO_SUPABASE_URL", "https://briokwdoonawhxisbydy.supabase.co");
  vi.stubEnv("CCO_SUPABASE_SERVICE_ROLE_KEY", "offline-placeholder");
  vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/not-read/offline.json");
  vi.stubEnv("CCO_DISCOVERY_ACCEPTANCE_SCOPE", undefined);
  mocks.createClient.mockReturnValue({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) });
  mocks.metadata.mockResolvedValue({ data: { id: scope.calendarId, conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] } } });
  mocks.calendar.mockReturnValue({ calendars: { get: mocks.metadata } });
}
describe("acceptance scope runtime configuration", () => {
  test.each([
    "", " ", "not-json", "null", "[]", "{}",
    JSON.stringify({ ...scope, guestEmail: "invalid" }),
    JSON.stringify({ ...scope, organizerEmail: "invalid" }),
    JSON.stringify({ ...scope, submissionId: "not-a-uuid" }),
    JSON.stringify({ ...scope, calendarId: "" }),
    JSON.stringify({ ...scope, guestEmail: null }),
    JSON.stringify({ calendarId: scope.calendarId, organizerEmail: scope.organizerEmail, guestEmail: scope.guestEmail }),
    JSON.stringify({ ...scope, extraField: "typo" }),
  ])("malformed or incomplete configured scope fails closed before DB/provider initialization: %s", async (raw) => {
    configure(); vi.stubEnv("CCO_DISCOVERY_ACCEPTANCE_SCOPE", raw);
    expect(await discoveryRuntime()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.calendar).not.toHaveBeenCalled();
  });
  test.each([
    { ...scope, calendarId: "another-calendar" },
    { ...scope, organizerEmail: "other@example.test" },
  ])("scope must match the runtime calendar and organizer before DB/provider initialization", async (configured) => {
    configure(); vi.stubEnv("CCO_DISCOVERY_ACCEPTANCE_SCOPE", JSON.stringify(configured));
    expect(await discoveryRuntime()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.calendar).not.toHaveBeenCalled();
  });
  test("valid exact scope is preserved in runtime booking configuration", async () => {
    configure(); vi.stubEnv("CCO_DISCOVERY_ACCEPTANCE_SCOPE", JSON.stringify(scope));
    expect((await discoveryRuntime())?.config).toEqual({ calendarId: scope.calendarId, organizerEmail: scope.organizerEmail, acceptanceScope: scope });
  });
  test("an unset scope preserves the gated production runtime", async () => {
    configure();
    expect(await discoveryRuntime()).not.toBeNull();
    vi.stubEnv("CCO_DISCOVERY_BOOKING_CONTRACT", "");
    expect(await discoveryRuntime()).toBeNull();
  });
});
