import s from "./page.module.css";

/**
 * Discovery calls are booked by email for now. The former calendar path was
 * retired because it could report a reservation without a canonical durable
 * booking receipt, and /api/cco/bookings plus /api/cco/bookings/availability
 * stay hard-off (503 booking_unavailable). Keep this page email-only, with no
 * calendar fetches, until CCO has a CCO-DB-backed calendar and confirmation
 * workflow.
 */
const BOOKING_EMAIL = "service@contentco-op.com";
const BOOKING_EMAIL_SUBJECT = "Discovery call";
const BOOKING_MAILTO = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(BOOKING_EMAIL_SUBJECT)}`;

export function BookingClient() {
  return (
    <section className={s.bookingPanel} aria-labelledby="book-by-email-title">
      <div className={s.bookingHeader}>
        <h2 id="book-by-email-title">Book a discovery call by email</h2>
      </div>
      <div className={s.emailBody}>
        <p className={s.emailLead}>
          Send us a note about your project and our team will reply to set up the call.
        </p>
        <ul className={s.emailList}>
          <li>Your name and company</li>
          <li>What you want to make, and roughly when</li>
          <li>A few days and times that suit you</li>
        </ul>
        <div className={s.emailActions}>
          <a className={s.emailCta} href={BOOKING_MAILTO}>
            Email us to book
          </a>
          <p className={s.emailAddress}>
            Or write to <a href={BOOKING_MAILTO}>{BOOKING_EMAIL}</a>
          </p>
        </div>
      </div>
    </section>
  );
}
