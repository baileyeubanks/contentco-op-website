export type CcoNavSurface =
  | "monorepo"
  | "home"
  | "portfolio"
  | "brief"
  | "booking"
  | "login"
  | "suite"
  | "cocut"
  | "coscript"
  | "codeliver"
  | "terms"
  | "privacy";

export type CcoUrls = {
  monorepo: string;
  home: string;
  portfolio: string;
  suite: string;
  booking: string;
  bookingAlias: string;
  brief: string;
  client: string;
  cocut: string;
  coscript: string;
  codeliver: string;
};

export const CCO_URLS: CcoUrls = {
  monorepo: "https://github.com/baileyeubanks/blaze-v4",
  home: "/",
  portfolio: "/portfolio",
  suite: "/suite",
  booking:
    "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3V2sQevdtlybFNEhEe3DQ5gE4GNdwNlH-47cIn5iFy0eUY7qxfraJnlq0c7iVoqjGbjhso2ZHl?gv=true",
  bookingAlias: "/book",
  brief: "/brief",
  client: "/login",
  // Product hosts are not currently DNS-live; keep public CTAs on the suite surface.
  cocut: "/co-cut",
  coscript: "/co-script",
  codeliver: "/co-deliver",
};
