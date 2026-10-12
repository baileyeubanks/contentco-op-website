import { CCO_URLS } from "@contentco-op/ui";
import s from "./page.module.css";

/**
 * Discovery calls are booked inside Bailey's Google Calendar appointment page,
 * embedded here, so Google owns the reservation and its confirmation email.
 * Do not restore slot-picking against the retired CCO booking API routes
 * (retired in b0859f6): they could report a reservation without a calendar
 * receipt.
 */
export const CCO_DISCOVERY_CALL_EMBED_URL = CCO_URLS.booking;

export function BookingClient() {
  return (
    <div className={s.calendarCard}>
      <iframe
        className={s.calendarFrame}
        src={CCO_DISCOVERY_CALL_EMBED_URL}
        title="Pick a time for a 30-minute discovery call with Bailey"
        loading="lazy"
      />
    </div>
  );
}
