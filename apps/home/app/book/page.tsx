import { Suspense } from "react";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { PublicPageIntro } from "@/app/components/public-page-intro";
import { BookingClient } from "./booking-client";
import s from "./page.module.css";

export default function BookPage() {
  return (
    <PublicPageLayout surface="booking" theme="cream">
      <main className={s.page}>
        <section className={s.shell}>
        <PublicPageIntro
          eyebrow="Discovery Call"
          title={<>Let&rsquo;s <em>Talk.</em></>}
          description="Contact our team to arrange a discovery call about your project."
          align="center"
          className={s.header}
        />

        <Suspense fallback={<div className={s.loadingPanel}>Loading contact options...</div>}>
          <BookingClient />
        </Suspense>
      </section>

      </main>
    </PublicPageLayout>
  );
}
