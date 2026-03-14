export type CcoNavSurface =
  | "home"
  | "portfolio"
  | "brief"
  | "booking"
  | "login";

export type CcoUrls = {
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
  home: "/",
  portfolio: "/portfolio",
  booking: "/book",
  brief: "/brief",
  client: "/login",
  cocut: "https://cut.contentco-op.com",
  coscript: "https://script.contentco-op.com",
  codeliver: "https://deliver.contentco-op.com",
};
