import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BookingClient } from "@/app/book/booking-client";
import { POST as bookingPOST } from "@/app/api/cco/bookings/route";
import { GET as availabilityGET } from "@/app/api/cco/bookings/availability/route";

const MAILTO = "mailto:service@contentco-op.com?subject=Discovery%20call";
const LEAD = "Send us a note about your project and our team will reply to set up the call.";
const BOOK_DIR = path.resolve(__dirname, "../../app/book");

function listBookSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listBookSources(full) : [full];
  });
}

// Drop block comments and line comments (but not the "//" inside URLs) so the
// copy scan only sees text that can render or ship as metadata.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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
    expect(html).not.toContain("\u2013");
    expect(html).not.toMatch(/instant|calendar|within \d|24 hours/i);
  });

  test("panel has one lead sentence and no repeated Discovery Call kicker", () => {
    expect(html).toContain(`>${LEAD}</p>`);
    expect(html).not.toMatch(/a few times that work for you/i);
    expect(html).not.toContain("Discovery Call");
  });

  test("source scan of app/book/** (page intro, metadata, panel, css) stays clean", () => {
    const files = listBookSources(BOOK_DIR);
    const names = files.map((file) => path.relative(BOOK_DIR, file)).sort();
    expect(names).toEqual(expect.arrayContaining(["booking-client.tsx", "layout.tsx", "page.module.css", "page.tsx"]));
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const rel = path.relative(BOOK_DIR, file);
      expect(raw, `${rel} contains bailey@`).not.toMatch(/bailey@/i);
      expect(raw, `${rel} contains an em dash`).not.toContain("\u2014");
      expect(raw, `${rel} contains an en dash`).not.toContain("\u2013");
      expect(raw, `${rel} contains an escaped dash entity or unicode escape`).not.toMatch(
        /&(m|n)dash;|&#(8212|8211|x201[34]);|\\u201[34]/i,
      );
      expect(stripComments(raw), `${rel} mentions calendar or unavailable`).not.toMatch(/calendar|unavailable/i);
    }
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
