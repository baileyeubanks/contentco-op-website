"use client";

import s from "./page.module.css";

/**
 * The former calendar path was retired because it could report a reservation
 * without a canonical durable booking receipt. Keep the public page explicit
 * until CCO has a CCO-DB-backed calendar and confirmation workflow.
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
        Online discovery-call scheduling is temporarily unavailable. No time has been reserved.
      </p>
      <p className={s.note}>
        Please email <a href="mailto:service@contentco-op.com">service@contentco-op.com</a> and our team will arrange a time with you.
      </p>
    </section>
  );
}
