export type CcoNavSurface =
  | "monorepo"
  | "home"
  | "portfolio"
  | "brief"
  | "booking"
  | "login"
  | "cocut"
  | "coscript"
  | "codeliver";

export type CcoUrls = {
  monorepo: string;
  home: string;
  portfolio: string;
  booking: string;
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
  booking: "/book",
  brief: "/brief",
  client: "/login",
  cocut: "/co-cut",
  coscript: "/co-script",
  codeliver: "/co-deliver",
};
