import Link from "next/link";
import { CCO_URLS } from "@contentco-op/ui";
import { BOOKING_PAGE_PATH, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export function PublicFooter() {
  return (
    <footer className="cc-footer">
      <div className="cc-footer-inner">
        <nav className="cc-footer-links" aria-label="Footer links">
          <Link href={CCO_URLS.home}>Home</Link>
          <Link href={CCO_URLS.portfolio}>Portfolio</Link>
          <Link href={CCO_URLS.suite}>Product Suite</Link>
          <Link href={CREATIVE_BRIEF_PATH}>Creative Brief</Link>
          <Link href={BOOKING_PAGE_PATH}>Book a Call</Link>
        </nav>
        <div className="cc-footer-meta">
          <a href="mailto:service@contentco-op.com">service@contentco-op.com</a>
          <span className="cc-footer-sep" aria-hidden="true">&middot;</span>
          <span>Houston, Texas</span>
          <span className="cc-footer-sep" aria-hidden="true">&middot;</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
