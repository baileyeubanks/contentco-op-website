import Link from "next/link";
import { PublicPageLayout } from "./components/public-page-layout";
import s from "./not-found.module.css";

export default function NotFound() {
  return (
    <PublicPageLayout surface="home" theme="cream">
      <main className={s.main}>
        <div className={s.inner}>
          <p className={s.code}>Error 404</p>
          <h1 className={s.title}>Page not found</h1>
          <p className={s.lede}>
            This page doesn&apos;t exist. Maybe it moved, maybe it never was.
          </p>
          <Link href="/" className={s.cta}>
            Back to home
          </Link>
        </div>
      </main>
    </PublicPageLayout>
  );
}
