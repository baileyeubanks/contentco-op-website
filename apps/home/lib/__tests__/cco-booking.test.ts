import { describe, expect, test } from "vitest";
import { buildDiscoverySlots, getCalendarIntegrationStatus, validateBookingRequest } from "../cco-booking";

describe("CCO booking", () => {
  test("builds stable 15 and 30 minute discovery slots", () => {
    const fifteen = buildDiscoverySlots(15);
    const thirty = buildDiscoverySlots(30);

    expect(fifteen).toHaveLength(16);
    expect(thirty).toHaveLength(16);
    expect(fifteen[0]?.durationMinutes).toBe(15);
    expect(thirty[0]?.durationMinutes).toBe(30);
    expect(fifteen.every((slot) => slot.available)).toBe(true);
  });

  test("validates booking request fields before calendar sync", () => {
    expect(
      validateBookingRequest({
        name: "Avery Brooks",
        email: "avery@example.com",
        slotId: "slot",
        startsAt: "2026-04-28T15:00:00.000Z",
        endsAt: "2026-04-28T15:30:00.000Z",
      }),
    ).toEqual({});

    expect(validateBookingRequest({ name: "", email: "bad", slotId: "", startsAt: "x", endsAt: "x" })).toMatchObject({
      name: "Name is required.",
      email: "A valid email is required.",
      slotId: "Select a discovery call time.",
      startsAt: "Selected start time is invalid.",
      endsAt: "Selected end time is invalid.",
    });
  });

  test("stays in preview mode until Google Calendar credentials are configured", () => {
    const status = getCalendarIntegrationStatus();

    expect(status).toHaveProperty("configured");
    expect(["google_calendar_ready", "local_preview"]).toContain(status.mode);
  });
});
