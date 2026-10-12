import Image from "next/image";
import Link from "next/link";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { PublicPageIntro } from "@/app/components/public-page-intro";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";
import { BookingClient } from "./booking-client";
import s from "./page.module.css";

const CALL_AGENDA = [
  "The story, and who needs to see it",
  "Site, safety, and access at your facility",
  "Budget, timeline, and a path to a shoot date",
] as const;

const PROOF_LOGOS = [
  { src: "/cc/logos/bp.svg", alt: "BP", width: 64, height: 34 },
  { src: "/cc/logos/shell.png", alt: "Shell", width: 48, height: 30 },
  { src: "/cc/logos/schneider-electric.svg", alt: "Schneider Electric", width: 120, height: 30 },
  { src: "/cc/logos/abb.svg", alt: "ABB", width: 90, height: 29 },
  { src: "/cc/logos/citgo.png", alt: "CITGO", width: 56, height: 31 },
  { src: "/cc/logos/kodiak.svg", alt: "Kodiak Gas Services", width: 116, height: 30 },
  { src: "/cc/logos/copart.png", alt: "Copart", width: 102, height: 31 },
] as const;

export default function BookPage() {
  return (
    <PublicPageLayout surface="booking" theme="cream">
      <main className={s.page}>
        <section className={s.shell}>
          <PublicPageIntro
            eyebrow="Discovery Call"
            title={<>Let&rsquo;s <em>Talk.</em></>}
            description="Thirty minutes with Bailey. Bring the story — we'll bring a plan."
            align="center"
            className={s.header}
          />

          <div className={s.bookingGrid}>
            <aside className={s.host}>
              <div className={s.hostPhoto}>
                <Image
                  src="/cc/photos/bailey-headshot-20261003.jpeg"
                  alt="Bailey Eubanks"
                  fill
                  sizes="(max-width: 860px) 160px, 340px"
                  quality={85}
                  priority
                />
              </div>
              <div className={s.hostSignoff}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cc/signature-bailey.png"
                  alt="Bailey Eubanks"
                  className={s.hostSignature}
                  width={470}
                  height={117}
                />
                <span className={s.kicker}>Founder &amp; Executive Producer</span>
              </div>

              <div className={s.agenda}>
                <p className={s.kicker}>On the call</p>
                <ol>
                  {CALL_AGENDA.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>

              <Link href={CREATIVE_BRIEF_PATH} className={s.briefLink}>
                Rather write it down first? <span>Start the creative brief &rarr;</span>
              </Link>
            </aside>

            <BookingClient />
          </div>

          <div className={s.proof} aria-label="Clients">
            <p className={s.kicker}>On site for</p>
            <div className={s.proofLogos}>
              {PROOF_LOGOS.map((logo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width}
                  height={logo.height}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicPageLayout>
  );
}
