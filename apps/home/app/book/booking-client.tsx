"use client";

import s from "./page.module.css";

/**
 * Online scheduling stays closed until a CCO-DB booking record and an
 * idempotent calendar receipt exist. The former Google/Firebase preview path
 * (retired in b0859f6) could report a reservation without that receipt.
 * Do not restore slot-picking against the retired booking APIs while those
 * routes return `booking_unavailable`.
 */
export function BookingClient() {
  return (
    <section className={s.bookingPanel} aria-live="polite">
      <div className={s.bookingHeader}>
        <div>
          <p className={s.kicker}>Discovery Call</p>
          <h2>Scheduling unavailable</h2>
        </div>
      </div>
      <p className={s.error}>
        Online discovery-call scheduling is not offered here. No time has been reserved.
      </p>
      <p className={s.note}>
        Email <a href="mailto:service@contentco-op.com">service@contentco-op.com</a> to arrange a
        call, or start a <a href="/brief">creative brief</a> and we will follow up.
      </p>
    </section>
  );
}
