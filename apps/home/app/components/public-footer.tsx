import Link from "next/link";
import { CCO_URLS } from "@contentco-op/ui";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export function PublicFooter() {
  return (
    <footer className="cc-footer">
      <div className="cc-footer-inner">
        <Link href={CCO_URLS.home} className="cc-footer-brand" aria-label="Content Co-op">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cc-footer-logo"
            src="/brand/assets/cco/logos/aperture/aperture-mark.svg"
            alt="Content Co-op"
            width="37"
            height="32"
            decoding="async"
          />
        </Link>
        <nav className="cc-footer-links" aria-label="Footer links">
          <Link href={CCO_URLS.home}>Home</Link>
          <Link href={CCO_URLS.portfolio}>Portfolio</Link>
          <Link href={CREATIVE_BRIEF_PATH}>Creative Brief</Link>
          <Link href="/book">Book</Link>
          <Link href="/suite">Suite</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <div className="cc-footer-contact" aria-label="Contact information">
          <a href="mailto:service@contentco-op.com">service@contentco-op.com</a>
          <span className="cc-footer-sep" aria-hidden="true">&middot;</span>
          <a href="tel:+15013515927">501-351-5927</a>
        </div>
        <div className="cc-footer-meta">
          <span>Houston, Texas</span>
          <span className="cc-footer-sep" aria-hidden="true">&middot;</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
