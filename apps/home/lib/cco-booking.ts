import { google } from "googleapis";

export type DiscoveryDuration = 15 | 20 | 30;

export interface CcoBookingSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: DiscoveryDuration;
  label: string;
  available: boolean;
  source: "google_freebusy_ready" | "local_preview";
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

type CalendarEventResult =
  | {
      ok: true;
      mode: "google_calendar_ready";
      eventId: string | null;
      htmlLink: string | null;
    }
  | {
      ok: true;
      mode: "local_preview";
      eventId: null;
      htmlLink: null;
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

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function firstSchedulableDay() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 14, 0, 0));
  return tomorrow;
}

export function getCalendarIntegrationStatus() {
  const calendarId = process.env.CCO_DISCOVERY_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID || "";
  const hasCredential = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_DWD_SERVICE_ACCOUNT_FILE ||
      process.env.GOOGLE_OAUTH_TOKEN_FILE_BLAZE,
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
  const hourStarts = [15, 16.5, 19, 20.5];

  for (let dayOffset = 0; slots.length < 16 && dayOffset < days + 6; dayOffset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + dayOffset);
    if (isWeekend(day)) continue;

    for (const hour of hourStarts) {
      const wholeHour = Math.floor(hour);
      const minute = hour % 1 === 0 ? 0 : 30;
      const slotStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), wholeHour, minute, 0));
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

export async function getDiscoveryAvailability(durationMinutes: DiscoveryDuration = 20) {
  const status = getCalendarIntegrationStatus();
  const previewSlots = buildDiscoverySlots(durationMinutes);
  if (!status.configured || !status.calendarId) {
    return { calendar: status, slots: previewSlots };
  }

  try {
    const client = await getCalendarClient();
    if (!client) return { calendar: status, slots: previewSlots };
    const response = await client.calendar.freebusy.query({
      requestBody: {
        timeMin: previewSlots[0]?.startsAt,
        timeMax: previewSlots[previewSlots.length - 1]?.endsAt,
        items: [{ id: client.calendarId }],
      },
    });
    const busy = response.data.calendars?.[client.calendarId]?.busy || [];
    return {
      calendar: status,
      slots: previewSlots.map((slot) => ({
        ...slot,
        available: !overlapsBusy(slot.startsAt, slot.endsAt, busy),
        source: "google_freebusy_ready" as const,
      })),
    };
  } catch (error) {
    return {
      calendar: {
        ...status,
        mode: "local_preview",
        error: error instanceof Error ? error.message : "google_calendar_freebusy_failed",
      },
      slots: previewSlots,
    };
  }
}

export async function createDiscoveryCalendarEvent(request: CcoBookingRequest): Promise<CalendarEventResult> {
  const status = getCalendarIntegrationStatus();
  if (!status.configured || !status.calendarId) {
    return { ok: true, mode: "local_preview", eventId: null, htmlLink: null };
  }

  const client = await getCalendarClient();
  if (!client) return { ok: true, mode: "local_preview", eventId: null, htmlLink: null };
  const response = await client.calendar.events.insert({
    calendarId: client.calendarId,
    sendUpdates: "all",
    requestBody: {
      summary: `CCO discovery call: ${request.company || request.name}`,
      description: [
        request.briefId ? `Brief: ${request.briefId}` : null,
        request.notes ? `Notes: ${request.notes}` : null,
        "Created by CCO native booking flow.",
      ].filter(Boolean).join("\n"),
      start: { dateTime: request.startsAt, timeZone: DEFAULT_ZONE },
      end: { dateTime: request.endsAt, timeZone: DEFAULT_ZONE },
      attendees: [{ email: request.email, displayName: request.name }],
    },
  });

  return {
    ok: true,
    mode: "google_calendar_ready",
    eventId: response.data.id || null,
    htmlLink: response.data.htmlLink || null,
  };
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
