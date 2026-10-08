import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BookingClient } from "@/app/book/booking-client";
import { POST as bookingPOST } from "@/app/api/cco/bookings/route";
import { GET as availabilityGET } from "@/app/api/cco/bookings/availability/route";

const MAILTO = "mailto:service@contentco-op.com?subject=Discovery%20call";

describe("/book email-to-book copy", () => {
  const html = renderToStaticMarkup(createElement(BookingClient));

  test("renders an inviting email-to-book panel with a mailto to service@", () => {
    expect(html).toContain("Book a discovery call by email");
    expect(html).toContain("Email us to book");
    expect(html).toContain(`href="${MAILTO}"`);
    expect(html.match(/href="mailto:[^"]*"/g)).toEqual([`href="${MAILTO}"`, `href="${MAILTO}"`]);
    expect(html).toContain(">service@contentco-op.com</a>");
  });

  test("does not read as broken or promise calendar booking", () => {
    expect(html).not.toMatch(/unavailable/i);
    expect(html).not.toMatch(/No time has been reserved/i);
    expect(html).not.toMatch(/bailey@/i);
    expect(html).not.toContain("\u2014");
    expect(html).not.toMatch(/instant|calendar|within \d|24 hours/i);
  });

  test("booking endpoints stay hard-off with 503 booking_unavailable", async () => {
    const availability = await availabilityGET();
    const booking = await bookingPOST();
    expect(availability.status).toBe(503);
    expect(await availability.json()).toMatchObject({ error: "booking_unavailable", retryable: false });
    expect(booking.status).toBe(503);
    expect(await booking.json()).toMatchObject({ error: "booking_unavailable", retryable: false });
  });
});
