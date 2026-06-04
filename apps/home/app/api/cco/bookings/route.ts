import { NextResponse } from "next/server";
import { commitCcoFirestoreWrites } from "@/lib/cco-firebase-server";
import { createDiscoveryCalendarEvent, getCalendarIntegrationStatus, validateBookingRequest } from "@/lib/cco-booking";
import type { CcoFirestoreCollection } from "@/lib/cco-admin-model";

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firestoreWrite(collection: CcoFirestoreCollection, documentId: string, data: Record<string, unknown>) {
  return {
    collection,
    documentId,
    path: `${collection}/${documentId}`,
    data,
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors = validateBookingRequest(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "invalid_booking", errors }, { status: 400 });
  }

  const calendar = getCalendarIntegrationStatus();
  const bookingId = `booking_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const auditId = `audit_${bookingId}`;
  const requestedDuration = Number(body.durationMinutes);
  const durationMinutes = requestedDuration === 15 ? 15 as const : requestedDuration === 30 ? 30 as const : 20 as const;
  const booking = {
    id: bookingId,
    briefId: cleanString(body.briefId) || null,
    name: cleanString(body.name),
    email: cleanString(body.email).toLowerCase(),
    company: cleanString(body.company) || null,
    durationMinutes,
    slotId: cleanString(body.slotId),
    startsAt: cleanString(body.startsAt),
    endsAt: cleanString(body.endsAt),
    notes: cleanString(body.notes) || null,
    status: calendar.configured ? "calendar_sync_ready" : "stored_for_admin_review",
    calendar,
    createdAt: new Date().toISOString(),
  };
  const calendarEvent = await createDiscoveryCalendarEvent({
    briefId: booking.briefId || undefined,
    name: booking.name,
    email: booking.email,
    company: booking.company || undefined,
    durationMinutes: booking.durationMinutes,
    slotId: booking.slotId,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    notes: booking.notes || undefined,
  });
  const bookingRecord = {
    ...booking,
    status: calendarEvent.mode === "google_calendar_ready" ? "calendar_event_created" : booking.status,
    calendarEvent,
  };
  const writes = [
    firestoreWrite("bookings", bookingId, bookingRecord),
    firestoreWrite("auditEvents", auditId, {
      id: auditId,
      type: "public.discovery_booking_requested",
      actorType: "public_lead",
      briefId: booking.briefId,
      bookingId,
      calendarMode: calendarEvent.mode,
      createdAt: booking.createdAt,
    }),
  ];
  const persistence = await commitCcoFirestoreWrites(writes);

  return NextResponse.json({
    ok: true,
    booking: {
      ...bookingRecord,
      firestorePaths: writes.map((write) => write.path),
    },
    persistence,
  });
}
