import type { ReactNode } from "react";
import { CCO_URLS } from "@contentco-op/ui";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

/**
 * What Co-VideoPro does today. This is the single source of truth for the
 * Home and Suite product sections, so the two can never drift apart again.
 * Only describe shipped behaviour here. Anything unbuilt belongs in
 * SUITE_COMING, and is labelled "Coming".
 */
export type SuiteCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  /** Visible label on the card's button. */
  cta: string;
  href: string;
  /** Opens a different site (co-videopro.com / client.contentco-op.com). */
  external: boolean;
  /** Accessible name; includes where the button goes. */
  ariaLabel: string;
  icon: ReactNode;
};

export const CO_VIDEOPRO_STAFF_URL = "https://co-videopro.com/projects";

export const SUITE_INTRO =
  "Co-VideoPro is where every project runs: review the cut, approve it, deliver the final files, and handle the quote, signature and payment in the same place.";

export const SUITE_CARDS: SuiteCard[] = [
  {
    id: "review",
    name: "Review",
    tagline: "Notes on the film, not in your inbox.",
    description:
      "Clients watch the cut and leave comments right in the player, and our team replies in the same thread. Every version of the film stays in one place.",
    accent: "#4c8ef5",
    cta: "Open Co-VideoPro",
    href: CO_VIDEOPRO_STAFF_URL,
    external: true,
    ariaLabel: "Open Co-VideoPro (for the Content Co-op team)",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="2" y="14" width="36" height="12" rx="2" stroke="currentColor" strokeWidth={1.4} />
        <line x1="10" y1="14" x2="10" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="18" y1="14" x2="18" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="26" y1="14" x2="26" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="34" y1="14" x2="34" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="22" y1="9" x2="22" y2="31" stroke="currentColor" strokeWidth={1.8} />
        <polygon points="19,9 25,9 22,12" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "deliver",
    name: "Deliver",
    tagline: "Approve it, then take it home.",
    description:
      "Clients sign in to their own project, approve the cut when it is right, and get the approved film and final files from the same page.",
    accent: "#2dd4bf",
    cta: "Client sign in",
    href: CCO_URLS.cvpLogin,
    external: true,
    ariaLabel: "Client sign in to Co-VideoPro",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="7" y="12" width="26" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M12 12l8 7 8-7" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M20 19v10" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
        <path d="M14 25h7.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
        <circle cx="29" cy="28.5" r="6" fill="#f3ede2" stroke="currentColor" strokeWidth={1.4} />
        <path d="M26.6 28.5l1.6 1.6 3.2-3.3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "quote-and-pay",
    name: "Quote & pay",
    tagline: "The paperwork lives with the project.",
    description:
      "Quotes, signatures and payments happen inside the client's project, so the price, the approval and the film all sit together. It starts with a creative brief.",
    accent: "#a78bf5",
    cta: "Request a quote",
    href: CREATIVE_BRIEF_PATH,
    external: false,
    ariaLabel: "Request a quote by starting a creative brief",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M10 4.5h14l6 6V35.5H10z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M24 4.5v7h6" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M15 16h12M15 21h9M15 26h12M15 31h7" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" opacity={0.62} />
      </svg>
    ),
  },
];

/** Not built yet. Shown plainly as "Coming", never as a feature. */
export const SUITE_COMING = {
  label: "Coming",
  title: "Script planning and transcript-based editing",
  description:
    "We plan to add tools for script planning and for editing from transcripts. They are not part of Co-VideoPro today.",
} as const;
