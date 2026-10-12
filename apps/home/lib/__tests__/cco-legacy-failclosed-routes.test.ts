import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { CCO_URLS } from "@contentco-op/ui";
import { POST as bookingPOST } from "@/app/api/cco/bookings/route";
import { GET as availabilityGET } from "@/app/api/cco/bookings/availability/route";
import { GET as firebaseStatusGET } from "@/app/api/cco/firebase/status/route";
import { GET as proposalPdfGET } from "@/app/api/cco/proposals/[id]/pdf/route";

describe("retired CCO preview routes", () => {
  test("never reports a discovery call as reserved without the canonical booking rail", async () => {
    const availability = await availabilityGET();
    const booking = await bookingPOST();

    expect(availability.status).toBe(503);
    expect(await availability.json()).toMatchObject({ error: "booking_unavailable" });
    expect(booking.status).toBe(503);
    expect(await booking.json()).toMatchObject({ error: "booking_unavailable" });

    const bookingClient = readFileSync(
      path.resolve(__dirname, "../../app/book/booking-client.tsx"),
      "utf8",
    );
    // Booking is handed to Google Calendar's embedded appointment page, which owns the reservation.
    expect(bookingClient).toMatch(/<iframe[\s\S]*src=\{CCO_DISCOVERY_CALL_EMBED_URL\}/);
    expect(bookingClient).toMatch(/CCO_URLS\.booking/);
    expect(CCO_URLS.booking).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\/[^/?]+\?gv=true$/);
    expect(bookingClient).not.toMatch(/\b(reserved|confirmed|you're booked)\b/i);
    expect(bookingClient).not.toMatch(/google_freebusy_ready/);
    expect(bookingClient).not.toMatch(/\/api\/cco\/bookings/);
  });

  test("never renders a fixture proposal PDF for an arbitrary identifier", async () => {
    const response = await proposalPdfGET();

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: "proposal_pdf_unavailable" });
  });

  test("does not expose Firebase preview status as CCO persistence health", async () => {
    const response = await firebaseStatusGET();

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: "legacy_firebase_status_retired" });
  });
});
