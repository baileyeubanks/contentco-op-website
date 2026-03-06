"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Nav } from "@contentco-op/ui";
import s from "./page.module.css";

const BOOKING_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3V2sQevdtlybFNEhEe3DQ5gE4GNdwNlH-47cIn5iFy0eUY7qxfraJnlq0c7iVoqjGbjhso2ZHl?gv=true";

declare global {
  interface Window {
    calendar?: {
      schedulingButton?: {
        load: (options: {
          url: string;
          color: string;
          label: string;
          target: HTMLElement;
        }) => void;
      };
    };
  }
}

export default function CoCreatePage() {
  const [schedulerReady, setSchedulerReady] = useState(false);

  useEffect(() => {
    if (!schedulerReady) return;

    let cancelled = false;

    const mountScheduler = (attempt = 0) => {
      if (cancelled) return;

      const target = document.getElementById("googleBookingButton");
      const loader = window.calendar?.schedulingButton?.load;

      if (target && loader) {
        target.innerHTML = "";
        loader({
          url: BOOKING_URL,
          color: "#104390",
          label: "Book an appointment",
          target,
        });
        return;
      }

      if (attempt < 20) {
        window.setTimeout(() => mountScheduler(attempt + 1), 300);
      }
    };

    mountScheduler();

    return () => {
      cancelled = true;
    };
  }, [schedulerReady]);

  return (
    <div className={s.wrap}>
      <Script
        src="https://calendar.google.com/calendar/scheduling-button-script.js"
        strategy="afterInteractive"
        onLoad={() => setSchedulerReady(true)}
      />

      <div className={s.shell}>
        <Nav surface="home" />

        <div className={s.header}>
          <div>
            <p className={s.kicker}>Co-Create</p>
            <h1 className={s.title}>Book an Appointment</h1>
            <p className={s.subtitle}>
              Start with a strategy call. If you already know the shape of the project, you can send
              the creative brief after you book.
            </p>
          </div>
        </div>

        <div className={s.bookingGrid}>
          <section className={s.panel}>
            <p className={s.panelLabel}>Schedule</p>
            <div className={s.schedulerWrap}>
              <div id="googleBookingButton" className={s.schedulerMount} />

              <a
                className={s.schedulerFallback}
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open calendar in a new tab
              </a>

              <p className={s.schedulerHelper}>
                Use the same name and email you want us to tie to the project. That keeps the follow-up
                clean when we move into proposal and production.
              </p>
            </div>
          </section>

          <section className={s.panel}>
            <p className={s.panelLabel}>What Happens Next</p>
            <div className={s.metaStack}>
              <div className={s.metaRow}>
                <span className={s.metaKey}>Step 1</span>
                <span className={s.metaVal}>Book a strategy call on the calendar.</span>
              </div>
              <div className={s.metaRow}>
                <span className={s.metaKey}>Step 2</span>
                <span className={s.metaVal}>We review the opportunity and frame the right scope.</span>
              </div>
              <div className={s.metaRow}>
                <span className={s.metaKey}>Step 3</span>
                <span className={s.metaVal}>If needed, we send the creative brief to gather details ahead of the call.</span>
              </div>
              <div className={s.metaRow}>
                <span className={s.metaKey}>Step 4</span>
                <span className={s.metaVal}>The conversation feeds directly into root for quote and production follow-through.</span>
              </div>
            </div>

            <div className={s.bookingActions}>
              <a className={s.btnPrimary} href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book now
              </a>
              <a className={s.secondaryLink} href="/onboard">
                Prefer to send the creative brief first?
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
