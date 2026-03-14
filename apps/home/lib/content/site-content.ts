import { BOOKING_PAGE_PATH, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export const HOME_PAGE_CONTENT = {
  hero: {
    kicker: "Content Co-op",
    headline: "Industrial stories that hold up under scrutiny.",
    body:
      "Field-tested production for energy and industrial teams that need clear films, campaigns, and delivery-ready assets from the field to the boardroom.",
    primaryCta: {
      href: BOOKING_PAGE_PATH,
      label: "Book Strategy Call",
    },
    secondaryCta: {
      href: "/portfolio",
      label: "View Portfolio",
    },
    noteHref: CREATIVE_BRIEF_PATH,
    noteLabel: "Send the creative brief",
  },
  proof: {
    kicker: "Portfolio proof",
    title: "Selected work across energy, industrial, safety, and live operations.",
    body: "Start with finished work. The portfolio is where the brand promise either earns trust or loses it.",
    ctaHref: "/portfolio",
    ctaLabel: "View full portfolio",
  },
  focusCards: [
    {
      label: "Field credibility",
      title: "Built for crews who can spot fluff fast.",
      body: "The work has to read clearly in energy, industrial, and high-consequence environments where the audience already knows the job.",
    },
    {
      label: "Production discipline",
      title: "Strategy, production, edit, review, and delivery stay connected.",
      body: "Projects move from scope to final handoff without turning into disconnected decks, edits, and approval loops.",
    },
    {
      label: "Boardroom clarity",
      title: "The message survives review, not just the shoot day.",
      body: "Content Co-op is strongest when the work needs to hold up for operations, communications, and leadership at the same time.",
    },
  ],
  startCards: [
    {
      label: "Start with a call",
      title: "Book a strategy call",
      body: "Best when timing, scope, stakeholders, or production constraints still need live framing.",
      href: BOOKING_PAGE_PATH,
      cta: "Book strategy call",
    },
    {
      label: "Start with scope",
      title: "Send the creative brief",
      body: "Best when you already know the project shape and want structured intake before the first call.",
      href: CREATIVE_BRIEF_PATH,
      cta: "Send creative brief",
    },
    {
      label: "Already active?",
      title: "Client login",
      body: "Existing clients can review files, quotes, invoices, approvals, and delivery in the protected workspace.",
      href: "/login",
      cta: "Open client login",
    },
  ],
  gallery: [
    { src: "/cc/photos/gallery-control-room.jpg", alt: "BP control room operator monitoring screens", label: "Whiting Refinery", tag: "Production" },
    { src: "/cc/photos/gallery-drone-platform.jpg", alt: "DJI Inspire drone on offshore platform", label: "Aerial Unit", tag: "BTS" },
    { src: "/cc/photos/gallery-crew-refinery.jpg", alt: "CC crew prepping gimbal at refinery", label: "BP Whiting", tag: "BTS" },
    { src: "/cc/photos/gallery-crew-field-shoot.jpg", alt: "CC crew shooting in tall grass", label: "Fowler Ridge", tag: "BTS" },
    { src: "/cc/photos/gallery-machinist-cnc.jpg", alt: "Machinist operating CNC mill", label: "Precision MFG", tag: "Industrial" },
    { src: "/cc/photos/gallery-fire-gear-rack.jpg", alt: "Fire gear rack with American flag patch", label: "First Response", tag: "Safety" },
    { src: "/cc/photos/gallery-kodiak-crew.jpg", alt: "Kodiak field crew in hard hats", label: "Permian Basin", tag: "Upstream" },
    { src: "/cc/photos/gallery-lineman-boom.jpg", alt: "Lineman with boom mic reflector", label: "Wind Farm", tag: "Production" },
    { src: "/cc/photos/gallery-ceraweek-speaker.jpg", alt: "CeraWeek conference speaker", label: "CeraWeek", tag: "Events" },
    { src: "/cc/photos/fowler-wind-turbine.jpg", alt: "Wind turbine blade assembly at Fowler Ridge", label: "Fowler Ridge", tag: "Wind" },
    { src: "/cc/photos/whiting-refinery-sunset.jpg", alt: "Whiting Refinery skyline at golden hour", label: "Whiting Refinery", tag: "Downstream" },
    { src: "/cc/photos/gallery-wind-turbine-crane.jpg", alt: "Wind turbine crane lift at height", label: "Crane Lift", tag: "Wind" },
    { src: "/cc/photos/gallery-refinery-mountains.jpg", alt: "Refinery with snow-capped mountains", label: "Cherry Point", tag: "Downstream" },
    { src: "/cc/photos/gallery-helipad-sunset.jpg", alt: "Offshore helipad at golden hour", label: "Atlantis", tag: "Offshore" },
    { src: "/cc/photos/gallery-aerial-solar.jpg", alt: "Aerial view of solar farm", label: "Solar Array", tag: "Renewables" },
    { src: "/cc/photos/gallery-desert-tanks.jpg", alt: "Desert storage tanks at golden hour", label: "Permian Basin", tag: "Upstream" },
    { src: "/cc/photos/gallery-refinery-pink-sunset.jpg", alt: "Refinery skyline with pink sunset and steam", label: "Whiting", tag: "Downstream" },
    { src: "/cc/photos/gallery-gas-station-sunset.jpg", alt: "Gas station at sunset", label: "Retail", tag: "Downstream" },
    { src: "/cc/photos/seagull-rope-access.jpg", alt: "Rope access workers on offshore platform", label: "Project Seagull", tag: "Offshore" }
  ],
} as const;
