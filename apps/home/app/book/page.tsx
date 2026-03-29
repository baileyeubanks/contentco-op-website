import Link from "next/link";
import { Nav } from "@contentco-op/ui";
import { PublicFooter } from "@/app/components/public-footer";
import { BOOKING_CALENDAR_URL, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";
import s from "./page.module.css";

export default function BookPage() {
  return (
    <main className={s.wrap}>
      <Nav surface="home" />

      <section className={s.shell}>
        <header className={s.header}>
          <div className={s.headerCopy}>
            <p className={s.kicker}>Schedule</p>
            <h1 className={s.title}>Book a call with Bailey.</h1>
            <p className={s.subtitle}>30 minutes. Google Meet. Pick a time that works.</p>
          </div>

          <div className={s.headerAside}>
            <p className={s.headerNote}>
              Start with the call. If the project is already taking shape, the brief can follow and
              keep the next conversation tight.
            </p>
            <Link className={s.secondaryLink} href={CREATIVE_BRIEF_PATH}>
              Prefer the creative brief first?
            </Link>
          </div>
        </header>

        <div className={s.grid}>
          <section className={s.calendarCard}>
            <div className={s.cardIntro}>
              <p className={s.cardLabel}>Meeting invite</p>
              <p className={s.cardText}>
                Use the same name and email you want tied to the project. That keeps follow-up,
                proposal, and production clean once the call turns into work.
              </p>
            </div>

            <div className={s.calendarFrame}>
              <iframe
                className={s.calendar}
                src={BOOKING_CALENDAR_URL}
                title="Book a call with Content Co-op"
                loading="lazy"
              />
            </div>

            <p className={s.helper}>
              Can&rsquo;t see the calendar?{" "}
              <a
                className={s.helperLink}
                href={BOOKING_CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open it directly &rarr;
              </a>
            </p>
          </section>

          <aside className={s.sideRail}>
            <section className={s.panel}>
              <p className={s.panelLabel}>What happens next</p>
              <div className={s.stepList}>
                <div className={s.step}>
                  <span className={s.stepIndex}>01</span>
                  <p className={s.stepText}>Book the call on the calendar.</p>
                </div>
                <div className={s.step}>
                  <span className={s.stepIndex}>02</span>
                  <p className={s.stepText}>We frame the scope, priorities, and decision path.</p>
                </div>
                <div className={s.step}>
                  <span className={s.stepIndex}>03</span>
                  <p className={s.stepText}>If needed, the creative brief follows with the right context.</p>
                </div>
              </div>
            </section>

            <section className={s.panel}>
              <p className={s.panelLabel}>Meeting notes</p>
              <p className={s.panelText}>
                Desktop is the cleanest way to book, but the page stays usable on tablet and phone.
                Google Calendar remains the booking engine. This shell only makes the invitation feel
                like part of the site instead of a dropped-in utility.
              </p>
            </section>
          </aside>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
