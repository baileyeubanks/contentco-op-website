import { google } from "googleapis";

export type DiscoveryDuration = 15 | 20 | 30;

export interface CcoBookingSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: DiscoveryDuration;
  label: string;
  available: boolean;
  source: "google_freebusy_ready" | "local_preview" | "pending_verification";
}

export interface CcoBookingRequest {
  briefId?: string;
  name: string;
  email: string;
  company?: string;
  durationMinutes: DiscoveryDuration;
  slotId: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

type CalendarEventResult = {
  ok: false;
  error: "canonical_booking_receipt_required";
  retryable: false;
};

const DEFAULT_ZONE = "America/Chicago";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSlotLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DEFAULT_ZONE,
  }).format(date);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function chicagoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const field = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  return { year: field("year"), month: field("month"), day: field("day"), hour: field("hour"), minute: field("minute") };
}
function chicagoTime(day: Date, hour: number, minute: number) {
  const desired = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
  const observed = chicagoParts(new Date(desired));
  const observedLocal = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
  return new Date(desired + desired - observedLocal);
}
function firstSchedulableDay() {
  const today = chicagoParts(new Date());
  return new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
}

export function getCalendarIntegrationStatus() {
  const calendarId = process.env.CCO_DISCOVERY_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID || "";
  const hasCredential = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  return {
    calendarId: calendarId || null,
    configured: Boolean(calendarId && hasCredential),
    mode: calendarId && hasCredential ? "google_calendar_ready" : "local_preview",
  };
}

async function getCalendarClient() {
  const status = getCalendarIntegrationStatus();
  if (!status.configured || !status.calendarId) return null;
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return {
    calendarId: status.calendarId,
    calendar: google.calendar({ version: "v3", auth }),
  };
}

export function buildDiscoverySlots(durationMinutes: DiscoveryDuration = 20, days = 8): CcoBookingSlot[] {
  const status = getCalendarIntegrationStatus();
  const slots: CcoBookingSlot[] = [];
  const start = firstSchedulableDay();
  const hourStarts = [10, 11.5, 14, 15.5];

  for (let dayOffset = 0; slots.length < 16 && dayOffset < days + 6; dayOffset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + dayOffset);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;

    for (const hour of hourStarts) {
      const wholeHour = Math.floor(hour);
      const minute = hour % 1 === 0 ? 0 : 30;
      const slotStart = chicagoTime(day, wholeHour, minute);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      const id = `${dateKey(slotStart)}-${String(wholeHour).padStart(2, "0")}${String(minute).padStart(2, "0")}-${durationMinutes}`;
      slots.push({
        id,
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
        durationMinutes,
        label: formatSlotLabel(slotStart),
        available: true,
        source: status.configured ? "google_freebusy_ready" : "local_preview",
      });
    }
  }

  return slots.slice(0, 16);
}

function overlapsBusy(start: string, end: string, busy: Array<{ start?: string | null; end?: string | null }>) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return busy.some((range) => {
    const busyStart = Date.parse(range.start || "");
    const busyEnd = Date.parse(range.end || "");
    return Number.isFinite(busyStart) && Number.isFinite(busyEnd) && startMs < busyEnd && endMs > busyStart;
  });
}

/** Provider availability only; this is not a booking or a durable receipt. */
export async function getDiscoveryAvailability(durationMinutes: DiscoveryDuration = 20) {
  const status = getCalendarIntegrationStatus();
  const unavailable = (error: string) => ({
    calendar: { ...status, mode: "unavailable" as const, error },
    slots: [] as CcoBookingSlot[],
  });
  if (!status.configured || !status.calendarId) {
    return unavailable("google_calendar_not_configured");
  }

  const candidates = buildDiscoverySlots(durationMinutes);
  try {
    const client = await getCalendarClient();
    if (!client) return unavailable("google_calendar_not_configured");
    const response = await client.calendar.freebusy.query({
      requestBody: {
        timeMin: candidates[0]?.startsAt,
        timeMax: candidates[candidates.length - 1]?.endsAt,
        items: [{ id: client.calendarId }],
      },
    });
    const result = response.data.calendars?.[client.calendarId];
    // Google can return HTTP 200 with errors for an individual calendar.
    // Missing or malformed data must never be interpreted as an empty diary.
    if (!result || result.errors?.length || !Array.isArray(result.busy)) {
      return unavailable("google_calendar_freebusy_unavailable");
    }
    if (result.busy.some((range) => {
      const start = Date.parse(range.start || "");
      const end = Date.parse(range.end || "");
      return !Number.isFinite(start) || !Number.isFinite(end) || end <= start;
    })) {
      return unavailable("google_calendar_freebusy_invalid");
    }
    return {
      calendar: status,
      slots: candidates.map((slot) => ({
        ...slot,
        available: !overlapsBusy(slot.startsAt, slot.endsAt, result.busy || []),
        source: "google_freebusy_ready" as const,
      })),
    };
  } catch {
    // Provider messages can contain identity/configuration details. Keep them
    // out of the public result and expose a stable failure code instead.
    return unavailable("google_calendar_freebusy_failed");
  }
}

/**
 * Deliberately guarded until a canonical CCO-DB claim, deterministic event ID,
 * durable event receipt, and reconciliation contract have been implemented.
 * Re-enabling a retired caller must not issue an invite before those exist.
 */
export async function createDiscoveryCalendarEvent(_request: CcoBookingRequest): Promise<CalendarEventResult> {
  void _request;
  return { ok: false, error: "canonical_booking_receipt_required", retryable: false };
}

export function validateBookingRequest(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
  const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
  const slotId = typeof body.slotId === "string" ? body.slotId : "";

  if (name.length < 2) errors.name = "Name is required.";
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "A valid email is required.";
  if (!slotId) errors.slotId = "Select a discovery call time.";
  if (!Number.isFinite(Date.parse(startsAt))) errors.startsAt = "Selected start time is invalid.";
  if (!Number.isFinite(Date.parse(endsAt))) errors.endsAt = "Selected end time is invalid.";

  return errors;
}
