import { createClient } from "@supabase/supabase-js";
import { google, calendar_v3 } from "googleapis";
import { BOOKING_CONTRACT, type AcceptanceScope, type BookingRecord, type BookingStore, type EventReceipt, type BookingProvider } from "./cco-discovery-booking-rail";
import { buildDiscoverySlots } from "./cco-booking";

function record(value: Record<string, unknown>): BookingRecord {
  return { id: String(value.id), submissionId: String(value.submission_id), calendarId: String(value.calendar_id), organizerEmail: String(value.organizer_email), fingerprint: String(value.fingerprint), name: String(value.name), email: String(value.email), startsAt: String(value.starts_at), endsAt: String(value.ends_at), state: value.state as BookingRecord["state"], receipt: value.receipt as EventReceipt | null };
}
function eventReceipt(event: calendar_v3.Schema$Event): EventReceipt {
  return { eventId: event.id || "", bookingId: event.extendedProperties?.private?.ccoBookingId || "", startsAt: event.start?.dateTime || "", endsAt: event.end?.dateTime || "", organizerEmail: event.organizer?.email?.toLowerCase() || "", attendees: (event.attendees || []).map((attendee) => attendee.email?.toLowerCase() || ""), meetUrl: event.conferenceData?.createRequest?.status?.statusCode === "success" ? event.conferenceData.entryPoints?.find((point) => point.entryPointType === "video")?.uri || "" : "", htmlLink: event.htmlLink || "" };
}
/** An absent scope retains the contract gate; any configured invalid scope blocks
 * initialization. One submission UUID limits acceptance to one durable booking. */
function acceptanceScope(raw: string | undefined): AcceptanceScope | null | undefined {
  if (raw === undefined) return undefined;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "calendarId,guestEmail,organizerEmail,submissionId") return null;
    if (typeof value.calendarId !== "string" || !value.calendarId.trim() || value.calendarId !== value.calendarId.trim() || value.calendarId.length > 1024) return null;
    if (typeof value.organizerEmail !== "string" || typeof value.guestEmail !== "string" || !/^\S+@\S+\.\S+$/.test(value.organizerEmail) || !/^\S+@\S+\.\S+$/.test(value.guestEmail) || value.organizerEmail.length > 254 || value.guestEmail.length > 254) return null;
    if (typeof value.submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.submissionId)) return null;
    return { calendarId: value.calendarId, organizerEmail: value.organizerEmail.toLowerCase(), guestEmail: value.guestEmail.toLowerCase(), submissionId: value.submissionId.toLowerCase() };
  } catch { return null; }
}
/** Explicit version gate prevents an ordinary deploy from enabling invitations.
 * Root release owner must verify schema, identity and isolated live acceptance
 * before setting this gate. Credential contents are never read by this module. */
export async function discoveryRuntime() {
  const env = process.env;
  const calendarId = env.CCO_DISCOVERY_CALENDAR_ID || "";
  const organizerEmail = (env.CCO_DISCOVERY_ORGANIZER_EMAIL || "").trim().toLowerCase();
  const scope = acceptanceScope(env.CCO_DISCOVERY_ACCEPTANCE_SCOPE);
  if (scope === null || (scope !== undefined && (scope.calendarId !== calendarId || scope.organizerEmail !== organizerEmail))) return null;
  const url = env.CCO_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = env.CCO_SUPABASE_SERVICE_ROLE_KEY || env.CCO_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || "";
  if (env.CCO_DISCOVERY_BOOKING_CONTRACT !== BOOKING_CONTRACT || !calendarId || !/^\S+@\S+\.\S+$/.test(organizerEmail) || !env.GOOGLE_APPLICATION_CREDENTIALS || !serviceKey) return null;
  try { if (new URL(url).protocol !== "https:" || new URL(url).hostname !== "briokwdoonawhxisbydy.supabase.co") return null; } catch { return null; }
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const probe = await db.from("cco_discovery_bookings").select("contract,state,receipt").limit(0);
  if (probe.error) return null;
  const calendar = google.calendar({ version: "v3", auth: new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/calendar"] }) });
  // Verify selected calendar identity; never use an unrelated default calendar.
  const metadata = await calendar.calendars.get({ calendarId });
  if (metadata.data.id !== calendarId || metadata.data.conferenceProperties?.allowedConferenceSolutionTypes?.includes("hangoutsMeet") !== true) return null;
  const store: BookingStore = {
    async claim(input, requestedCalendar, organizer, fingerprint, isOffered) {
      const { data, error } = await db.rpc("cco_claim_discovery_booking", { p_input: input, p_calendar_id: requestedCalendar, p_organizer_email: organizer, p_fingerprint: fingerprint, p_offered: isOffered });
      if (error || !data?.record) throw new Error("booking_claim_failed");
      return { record: record(data.record), fresh: data.fresh === true };
    },
    async settle(id, fingerprint, receipt) {
      const { data, error } = await db.rpc("cco_settle_discovery_booking", { p_id: id, p_fingerprint: fingerprint, p_receipt: receipt });
      if (error || !data) throw new Error("booking_settle_failed");
      return record(data);
    },
  };
  const provider: BookingProvider = {
    async available(startsAt, endsAt) {
      const response = await calendar.freebusy.query({ requestBody: { timeMin: startsAt, timeMax: endsAt, items: [{ id: calendarId }] } });
      const result = response.data.calendars?.[calendarId];
      if (!result || result.errors?.length || !Array.isArray(result.busy)) throw new Error("calendar_unavailable");
      if (result.busy.some((range) => !Number.isFinite(Date.parse(range.start || "")) || !Number.isFinite(Date.parse(range.end || "")) || Date.parse(range.end || "") <= Date.parse(range.start || ""))) throw new Error("calendar_invalid");
      return !result.busy.some((range) => Date.parse(range.start || "") < Date.parse(endsAt) && Date.parse(range.end || "") > Date.parse(startsAt));
    },
    async find(eventId) {
      try {
        const response = await calendar.events.get({ calendarId, eventId });
        if (response.data.status === "cancelled") throw new Error("calendar_event_cancelled");
        return eventReceipt(response.data);
      } catch (error) {
        if ((error as { code?: number }).code === 404) return null;
        throw error;
      }
    },
    async insert(booking, eventId) {
      const response = await calendar.events.insert({ calendarId, conferenceDataVersion: 1, sendUpdates: "all", requestBody: {
        id: eventId, summary: `CCO discovery call: ${booking.name}`, start: { dateTime: booking.startsAt, timeZone: "America/Chicago" }, end: { dateTime: booking.endsAt, timeZone: "America/Chicago" },
        attendees: [...new Set([booking.email, booking.organizerEmail])].map((email) => ({ email })),
        extendedProperties: { private: { ccoBookingId: booking.id, ccoContract: BOOKING_CONTRACT } },
        conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      } });
      return eventReceipt(response.data);
    },
  };
  async function availability() {
    const candidates = buildDiscoverySlots(20);
    const start = candidates[0]?.startsAt;
    const end = candidates[candidates.length - 1]?.endsAt;
    if (!start || !end) return [];
    const response = await calendar.freebusy.query({ requestBody: { timeMin: start, timeMax: end, items: [{ id: calendarId }] } });
    const result = response.data.calendars?.[calendarId];
    if (!result || result.errors?.length || !Array.isArray(result.busy)) throw new Error("calendar_unavailable");
    const claims = await db.from("cco_discovery_bookings").select("starts_at,ends_at").eq("calendar_id", calendarId).lt("starts_at", end).gt("ends_at", start);
    if (claims.error) throw new Error("booking_claims_unavailable");
    const busy = [...result.busy, ...(claims.data || []).map((claim) => ({ start: claim.starts_at as string, end: claim.ends_at as string }))];
    if (busy.some((range) => !Number.isFinite(Date.parse(range.start || "")) || !Number.isFinite(Date.parse(range.end || "")) || Date.parse(range.end || "") <= Date.parse(range.start || ""))) throw new Error("calendar_invalid");
    return candidates.filter((slot) => !busy.some((range) => Date.parse(range.start || "") < Date.parse(slot.endsAt) && Date.parse(range.end || "") > Date.parse(slot.startsAt))).map((slot) => ({ ...slot, source: "google_freebusy_ready" as const }));
  }
  return { config: { calendarId, organizerEmail, acceptanceScope: scope }, store, provider, availability };
}
