import { describe, expect, test } from "vitest";
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
