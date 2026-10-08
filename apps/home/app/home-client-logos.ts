// Home page "Trusted by" logo strip.
//
// Only clients Bailey has approved for Content Co-op marketing may appear in
// this strip. Approved for CCO marketing: Schneider Electric, ICA, bp, CITGO.
// ABB and Copart are approved for LinkedIn only, not the website.
// Shell, Maersk and Conexon are not approved and were removed on 2026-10-08.
// lib/__tests__/home-client-logos.test.ts fails if a non-approved name returns.

export type HomeClientLogo = {
  src: string;
  alt: string;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
};

export const CCO_MARKETING_APPROVED_CLIENTS = ["Schneider Electric", "ICA", "BP", "CITGO"] as const;

// Still in the strip but not on the approved list. Bailey rules on these via
// Blaze; each must move to the approved list or be removed. Nothing new may be
// added here.
export const HOME_LOGO_STRIP_PENDING_REVIEW = [
  "Wendy's",
  "UBS",
  "Kodiak Gas Services",
  "Facebook",
  "Mueller",
  "Pierpont",
  "Nature Conferences",
] as const;

export const HOME_CLIENT_LOGOS: readonly HomeClientLogo[] = [
  { src: "/cc/logos/bp.svg", alt: "BP", width: 72, height: 38, mobileWidth: 56, mobileHeight: 32 },
  { src: "/cc/logos/schneider-electric.svg", alt: "Schneider Electric", width: 136, height: 34, mobileWidth: 112, mobileHeight: 28 },
  { src: "/cc/logos/citgo.png", alt: "CITGO", width: 64, height: 35, mobileWidth: 50, mobileHeight: 29 },
  { src: "/cc/logos/wendys.png", alt: "Wendy's", width: 124, height: 35, mobileWidth: 98, mobileHeight: 28 },
  { src: "/cc/logos/ubs.png", alt: "UBS", width: 108, height: 34, mobileWidth: 86, mobileHeight: 28 },
  { src: "/cc/logos/kodiak.svg", alt: "Kodiak Gas Services", width: 132, height: 34, mobileWidth: 104, mobileHeight: 27 },
  { src: "/cc/logos/facebook.svg", alt: "Facebook", width: 116, height: 33, mobileWidth: 92, mobileHeight: 27 },
  { src: "/cc/logos/mueller.svg", alt: "Mueller", width: 112, height: 31, mobileWidth: 90, mobileHeight: 25 },
  { src: "/cc/logos/pierpont.svg", alt: "Pierpont", width: 118, height: 32, mobileWidth: 94, mobileHeight: 26 },
  { src: "/cc/logos/nature-conferences.png", alt: "Nature Conferences", width: 122, height: 36, mobileWidth: 98, mobileHeight: 29 },
];
