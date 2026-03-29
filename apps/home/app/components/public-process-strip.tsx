import Link from "next/link";
import { BOOKING_PAGE_PATH, CREATIVE_BRIEF_PATH, PRIMARY_DISCOVERY_PATH } from "@/lib/public-booking";

const STEPS = [
  {
    label: "01",
    title: "Capture the brief",
    detail: "Collect story, scope, production shape, and constraints in one place.",
    href: CREATIVE_BRIEF_PATH,
    cta: "Open Creative Brief",
    external: false,
  },
  {
    label: "02",
    title: "Shape the estimate",
    detail: "Turn the intake into a preliminary range and quote-ready handoff.",
    href: PRIMARY_DISCOVERY_PATH,
    cta: "Open the Brief",
    external: false,
  },
  {
    label: "03",
    title: "Confirm the schedule",
    detail: "Keep the booking inside the branded scheduling shell so the handoff stays intact.",
    href: BOOKING_PAGE_PATH,
    cta: "Book the Call",
    external: false,
  },
  {
    label: "04",
    title: "Move into production",
    detail: "Carry the approved scope into ROOT, Co-Script, Co-Cut, and delivery.",
    href: "/root",
    cta: "Open Root",
    external: false,
  },
] as const;

export function PublicProcessStrip() {
  return (
    <section className="public-process">
      <div className="public-process-header">
        <p className="public-kicker">How it moves</p>
        <h2 className="public-process-title">One path from intake to estimate, schedule, and production.</h2>
      </div>
      <div className="public-process-grid">
        {STEPS.map((step) => (
          <article key={step.label} className="public-process-card">
            <p className="public-process-index">{step.label}</p>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            {step.external ? (
              <a href={step.href} target="_blank" rel="noopener noreferrer">
                {step.cta}
              </a>
            ) : (
              <Link href={step.href}>{step.cta}</Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
