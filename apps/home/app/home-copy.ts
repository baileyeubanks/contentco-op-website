/**
 * Content Co-op — Homepage Copy
 *
 * All editable brand copy for the homepage lives here.
 * Update text without touching component files.
 */

export const HERO = {
  kicker: "Content Co-op",
  line1: "Minimal stage,",
  line2: "maximum signal.",
  ledeBold: "Industrial stories that hold up under scrutiny,",
  lede: "built for energy, industry, and live operations.",
  ctaPrimary: "Creative Brief",
  ctaSecondary: "Book a Call",
} as const;

export const HERO_VARIANTS = [
  { line1: "Minimal stage,", line2: "maximum signal." },
  { line1: "Built for", line2: "the field." },
  { line1: "Show the work,", line2: "not the noise." },
  { line1: "Stories that hold", line2: "under scrutiny." },
  { line1: "Every frame", line2: "earns trust." },
] as const;

export const PRODUCTS = {
  kicker: "Your production toolkit",
  items: [
    {
      prefix: "Co-",
      name: "Script",
      href: "/co-script",
      tagline: "Plan the story.",
      description: "AI-assisted scripting and storyboard planning for production teams.",
    },
    {
      prefix: "Co-",
      name: "Cut",
      href: "/co-cut",
      tagline: "Shape the film.",
      description: "Review, annotate, and approve edits with frame-accurate feedback.",
    },
    {
      prefix: "Co-",
      name: "Deliver",
      href: "/co-deliver",
      tagline: "Ship the work.",
      description: "Final delivery, version management, and client handoff in one place.",
    },
  ],
} as const;

export const FOUNDER = {
  name: "Bailey Eubanks",
  title: "Founder & Executive Producer",
  photo: "/cc/photos/bailey-headshot.jpg",
  quote:
    "12 years making content for industrial companies taught me one thing — the real story is always on the shop floor, never in the boardroom. That's where we shoot, and that's where the best films get cut.",
} as const;

export const SUITE = {
  kicker: "Product Suite",
  headline: "One workflow. Three tools.",
  lede: "Co-Script, Co-Cut, and Co-Deliver are built to work together. Each tool handles a distinct phase of production — planning, editing, and delivery — so the handoff between phases is seamless and nothing falls through the cracks.",
  items: [
    {
      prefix: "Co-",
      name: "Script",
      href: "/co-script",
      tagline: "Plan the story.",
      description:
        "Start with the brief. Co-Script uses your creative brief inputs, industry context, and production constraints to generate a working script framework. Interview questions, shot lists, and narrative arcs — structured for the field, not a writer's room.",
      features: [
        "AI-assisted script generation from brief inputs",
        "Interview question banks by industry",
        "Shot list and storyboard scaffolding",
        "Direct feed into Co-Cut for production",
      ],
    },
    {
      prefix: "Co-",
      name: "Cut",
      href: "/co-cut",
      tagline: "Shape the film.",
      description:
        "Review rough cuts, leave frame-accurate feedback, and manage the revision cycle without the email chain. Co-Cut gives clients and producers a shared workspace where notes are precise, versions are tracked, and approvals are clear.",
      features: [
        "Frame-accurate annotation and review",
        "Version comparison and approval tracking",
        "Client-facing review portal",
        "Revision history with audit trail",
      ],
    },
    {
      prefix: "Co-",
      name: "Deliver",
      href: "/co-deliver",
      tagline: "Ship the work.",
      description:
        "Final delivery, format management, and client handoff in one place. Co-Deliver packages approved cuts into the formats and specs each platform requires — then tracks delivery confirmation so nothing gets lost on the way out.",
      features: [
        "Multi-format export and packaging",
        "Platform-specific delivery specs",
        "Client handoff with confirmation tracking",
        "Archive and retrieval for future use",
      ],
    },
  ],
} as const;
