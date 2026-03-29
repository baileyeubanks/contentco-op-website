export type AssistantDomainProfile = {
  aliases: string[];
  brandName: string;
  canonicalDomain: string;
  contactPrompt: string;
  defaultReply: string;
  faqs: Array<{
    answer: string;
    keywords: string[];
    topic: string;
  }>;
  knowledge: string;
  routeKey: "acs" | "cco" | "cocut" | "codeliver" | "coscript";
  systemPrompt: string;
};

const DOMAIN_PROFILES: AssistantDomainProfile[] = [
  {
    routeKey: "acs",
    canonicalDomain: "astrocleanings.com",
    aliases: ["www.astrocleanings.com"],
    brandName: "Astro Cleaning Services",
    contactPrompt:
      "For booking, the fastest path is the instant quote tool on astrocleanings.com, or call/text (346) 401-5841.",
    defaultReply:
      "Astro Cleaning Services helps Houston-area households with standard, deep, move-out, Airbnb reset, and specialty cleaning. I can help with service fit, pricing guidance, and the quickest booking path.",
    systemPrompt:
      "You are the Astro Cleaning Services assistant. Be direct and warm, know the Houston service area, push booking questions toward the quote tool, and escalate billing or account issues to humans.",
    knowledge: `
Astro Cleaning Services is a Houston-area residential cleaning company.
Services: standard clean, deep clean, move-out, Airbnb reset, White Glove.
Add-ons: interior windows, power wash, carpet steam, laundry.
Pricing guidance:
- standard clean starts at $0.10/sqft with a $100 minimum
- deep clean starts at $0.16/sqft with a $155 minimum
Recurring discounts:
- weekly 30%
- biweekly 20%
- monthly 0%
Term discounts stack:
- 5% for 6-month term
- 10% for 12-month term
Primary CTA: use the instant quote tool on astrocleanings.com.
Phone support: call or text (346) 401-5841.
Do not mention Content Co-op or Co-Apps while serving Astro customers.
Billing or account issues should be escalated to a human.
`.trim(),
    faqs: [
      {
        topic: "services",
        keywords: ["services", "cleaning", "standard", "deep clean", "move-out", "airbnb", "white glove"],
        answer:
          "Astro offers standard, deep clean, move-out, Airbnb reset, and White Glove service, plus add-ons like interior windows, power wash, carpet steam, and laundry.",
      },
      {
        topic: "pricing",
        keywords: [
          "price",
          "pricing",
          "cost",
          "quote",
          "how much",
          "rate",
          "minimum",
          "start at",
          "starting point",
          "starting price",
          "smaller home",
          "deep cleaning",
          "deep clean minimum",
        ],
        answer:
          "Standard cleaning starts at $0.10 per square foot with a $100 minimum, and deep cleaning starts at $0.16 per square foot with a $155 minimum. The instant quote tool gives the fastest exact estimate.",
      },
      {
        topic: "recurring",
        keywords: ["weekly", "biweekly", "monthly", "recurring", "discount", "plan"],
        answer:
          "Recurring discounts are strongest on weekly service at 30%, then biweekly at 20%, with monthly at 0%. Term discounts of 5% for 6 months and 10% for 12 months can stack on top.",
      },
      {
        topic: "policy",
        keywords: [
          "billing",
          "refund",
          "charge",
          "complaint",
          "cancel",
          "cancellation",
          "account",
          "account review",
          "reschedule",
          "rescheduling",
          "voicemail",
          "real person",
          "human",
          "talk through a charge",
          "safest handoff",
          "handoff",
        ],
        answer:
          "Billing, cancellation, refund, complaint, voicemail follow-up, and account-review issues should go straight to a human. Call or text (346) 401-5841 so the Astro team can review the account directly.",
      },
      {
        topic: "booking",
        keywords: [
          "book",
          "schedule",
          "appointment",
          "quote",
          "availability",
          "call",
          "text",
          "after hours",
          "after-hours",
          "estimate",
          "direct help",
          "person",
        ],
        answer:
          "The fastest booking path is the quote tool on astrocleanings.com. If you want help directly, call or text (346) 401-5841.",
      },
      {
        topic: "service_area",
        keywords: [
          "area",
          "serve",
          "cover",
          "coverage",
          "houston",
          "downtown",
          "river oaks",
          "memorial",
          "heights",
          "montrose",
          "woodlands",
          "sugar land",
          "cypress",
        ],
        answer:
          "Astro serves Houston and surrounding neighborhoods including Downtown, River Oaks, Memorial, Houston Heights, Montrose, Cypress, Sugar Land, and The Woodlands. The quote tool is the quickest way to confirm coverage.",
      },
    ],
  },
  {
    routeKey: "cco",
    canonicalDomain: "contentco-op.com",
    aliases: ["www.contentco-op.com"],
    brandName: "Content Co-op",
    contactPrompt:
      "If you need a human handoff, submit a brief at contentco-op.com/brief or email bailey@contentco-op.com.",
    defaultReply:
      "Content Co-op helps industrial, energy, construction, and corporate teams move from brief to pre-production, production, post, and delivery. I can help with service fit, timeline expectations, pricing guidance, and the fastest next step.",
    systemPrompt:
      "You are the Content Co-op assistant. Be concise, direct, and creatively confident. Start with the answer, avoid invented claims, and guide prospects toward the brief form or a human handoff when needed.",
    knowledge: `
Content Co-op is a Houston-based commercial video production company led by Bailey Eubanks.
Core industries: energy, industrial, infrastructure, construction, manufacturing, and corporate B2B.
Core flow: brief -> pre-production -> production -> post -> delivery.
Primary CTA: submit a brief at contentco-op.com/brief.
Secondary CTA: email bailey@contentco-op.com for direct coordination.
Products:
- Co-Script: pre-production strategy, story structure, scripting, storyboard direction, production planning.
- Co-Cut: transcript-first editing, post-production polish, captions, export variants.
- Co-Deliver: review links, approvals, final delivery, format packaging.
Timeline guidance:
- Typical end-to-end project: 3-6 weeks.
- Quotes are usually turned around within 24 hours after a clear brief.
Pricing guidance:
- Scopes are custom, not flat-rate.
- Small one-day shoots often land in the low-to-mid four figures.
- Larger multi-day or series work trends higher.
Portfolio references include CITGO, BP, CERAWeek, and Kodiak Robotics.
`.trim(),
    faqs: [
      {
        topic: "services",
        keywords: ["services", "offer", "what do you do", "production", "video", "crew", "commercial production", "full-service"],
        answer:
          "Content Co-op handles full-service commercial video production, plus focused lanes for pre-production strategy, post-production editing, and delivery packaging.",
      },
      {
        topic: "pricing",
        keywords: ["price", "pricing", "cost", "quote", "budget", "rate", "rates"],
        answer:
          "Pricing is scoped per project. Small one-day shoots usually land in the low-to-mid four figures, while larger multi-day or series work trends higher. The fastest way to get a real number is the brief at contentco-op.com/brief.",
      },
      {
        topic: "timeline",
        keywords: ["timeline", "turnaround", "delivery", "how long", "how fast", "schedule", "weeks", "quote turnaround", "scope is clear"],
        answer:
          "Most projects run about 3 to 6 weeks from brief to final delivery, with quotes usually turned around within 24 hours once the scope is clear.",
      },
      {
        topic: "portfolio",
        keywords: ["portfolio", "examples", "clients", "work", "case study", "citgo", "bp", "ceraweek", "kodiak", "energy", "robotics", "interview", "coverage", "deliverable"],
        answer:
          "Recent work includes CITGO safety content, BP event coverage, CERAWeek interviews, and projects for teams like Kodiak Robotics. If you want examples close to your use case, tell me your industry or deliverable.",
      },
      {
        topic: "next_step",
        keywords: ["book", "start", "next step", "brief", "meeting", "call", "starting point", "kick off", "talk first", "talk to someone", "complex scope", "scope"],
        answer:
          "The best starting point is the brief at contentco-op.com/brief. If the scope is complex and you want to talk first, email bailey@contentco-op.com.",
      },
      {
        topic: "co_script",
        keywords: ["co-script", "co script", "script product", "pre-production tool", "pre-production", "pre production", "storyboard", "production plan"],
        answer:
          "Co-Script is the pre-production lane. It helps shape the message, script, storyboard direction, and production plan before the shoot.",
      },
      {
        topic: "co_cut",
        keywords: ["co-cut", "co cut", "editing tool", "post-production tool", "caption workflow"],
        answer:
          "Co-Cut is the editing lane. It focuses on transcript-first editing, caption support, export variants, and getting raw footage into a polished final state.",
      },
      {
        topic: "co_deliver",
        keywords: ["co-deliver", "co deliver", "review tool", "approval workflow", "delivery workflow"],
        answer:
          "Co-Deliver is the review and delivery lane. It is built for review links, approvals, revision tracking, and final handoff without version chaos.",
      },
    ],
  },
  {
    routeKey: "coscript",
    canonicalDomain: "script.contentco-op.com",
    aliases: ["co-script.contentco-op.com", "coscript.contentco-op.com"],
    brandName: "Co-Script",
    contactPrompt:
      "For account or login help, check your email for access links or contact the Content Co-op team directly.",
    defaultReply:
      "Co-Script is the pre-production lane for shaping message, script, storyboard direction, and production planning before cameras roll.",
    systemPrompt:
      "You are the Co-Script assistant. Focus on pre-production, be honest about what is live versus planned, and point account issues to human support when needed.",
    knowledge: `
Co-Script is the Content Co-op pre-production product.
Focus areas: creative brief interpretation, scripting, narrative structure, storyboard direction, messaging, interview planning, production prep.
Be honest about feature maturity and avoid claiming tooling that is not live.
Support path: if login or account access is broken, suggest checking email or contacting the team.
`.trim(),
    faqs: [
      {
        topic: "what_is_it",
        keywords: ["what is co-script", "what is this", "co-script", "co script", "script", "storyboard", "pre-production"],
        answer:
          "Co-Script helps teams turn a rough idea into a production-ready plan: message framing, script direction, storyboard logic, and production prep.",
      },
      {
        topic: "best_for",
        keywords: ["best for", "who is it for", "when should i use", "use case"],
        answer:
          "It is best when you know you need a video but still need the story, structure, interview direction, or production plan clarified before the shoot.",
      },
      {
        topic: "login",
        keywords: ["login", "sign in", "access", "invite", "password"],
        answer:
          "For access issues, start by checking your email for the latest invite or login link. If that still fails, contact the team so they can verify your account directly.",
      },
    ],
  },
  {
    routeKey: "cocut",
    canonicalDomain: "cut.contentco-op.com",
    aliases: ["co-cut.contentco-op.com"],
    brandName: "Co-Cut",
    contactPrompt:
      "If you hit an account or workspace issue, contact the team so they can verify access and project state.",
    defaultReply:
      "Co-Cut is the post-production lane for transcript-first editing, captions, export variants, and polishing footage that already exists.",
    systemPrompt:
      "You are the Co-Cut assistant. Focus on editing, exports, and post-production workflows. Be clear about what is live versus planned and avoid overpromising.",
    knowledge: `
Co-Cut is the Content Co-op editing and post-production product.
Focus areas: transcript-first editing, captions, export variants, post-production polish, delivery prep.
Do not invent unsupported product features. If unsure whether something is live, say that clearly and offer a human handoff.
`.trim(),
    faqs: [
      {
        topic: "what_is_it",
        keywords: ["what is co-cut", "what is this", "co-cut", "co cut", "edit", "editing", "post-production"],
        answer:
          "Co-Cut is built for post-production work: transcript-first editing, caption support, output variants, and getting raw footage into a finished state.",
      },
      {
        topic: "exports",
        keywords: ["export", "formats", "deliverables", "captions", "social", "versions"],
        answer:
          "Co-Cut is meant to help teams shape final edits and output the right versions for client review, internal use, or platform-specific delivery.",
      },
      {
        topic: "support",
        keywords: ["login", "bug", "workspace", "account", "broken", "issue"],
        answer:
          "For account, workspace, or reliability issues, I can point you in the right direction, but the safest move is to contact the team so they can inspect the specific project state.",
      },
    ],
  },
  {
    routeKey: "codeliver",
    canonicalDomain: "deliver.contentco-op.com",
    aliases: ["co-deliver.contentco-op.com", "codeliver.contentco-op.com", "coproof.contentco-op.com"],
    brandName: "Co-Deliver",
    contactPrompt:
      "If a review link, approval, or account handoff is blocked, contact the team so they can inspect the exact workspace state.",
    defaultReply:
      "Co-Deliver is the review and delivery lane for feedback, approvals, version control, and handing finished assets off cleanly.",
    systemPrompt:
      "You are the Co-Deliver assistant. Focus on review links, approvals, revision tracking, and final delivery. Be clear about live versus planned functionality.",
    knowledge: `
Co-Deliver is the Content Co-op review and delivery product.
Focus areas: review links, feedback capture, revision tracking, approval workflows, final delivery packaging.
Avoid claiming features that are not currently live.
`.trim(),
    faqs: [
      {
        topic: "what_is_it",
        keywords: ["what is co-deliver", "what is this", "co-deliver", "co deliver", "delivery", "review", "approval"],
        answer:
          "Co-Deliver is for review and handoff: feedback, approval flow, revision tracking, and getting final assets packaged cleanly.",
      },
      {
        topic: "review_flow",
        keywords: ["review", "feedback", "approval", "approve", "comments", "versions"],
        answer:
          "The core use case is getting the right people into one review flow, tracking revisions clearly, and landing on a final approved delivery without version chaos.",
      },
      {
        topic: "support",
        keywords: ["login", "account", "link broken", "access", "issue"],
        answer:
          "If a review link or account path is not behaving, contact the team so they can verify the exact workspace, permissions, and delivery state.",
      },
    ],
  },
];

function normalizeDomain(domain?: string) {
  return (domain || "").trim().toLowerCase();
}

export function resolveAssistantDomain(domain?: string): AssistantDomainProfile {
  const normalized = normalizeDomain(domain);

  if (!normalized) {
    return DOMAIN_PROFILES[1];
  }

  const direct = DOMAIN_PROFILES.find((profile) =>
    profile.canonicalDomain === normalized || profile.aliases.includes(normalized),
  );
  if (direct) {
    return direct;
  }

  if (normalized.includes("astrocleanings.com")) return DOMAIN_PROFILES[0];
  if (normalized.includes("script.contentco-op.com")) return DOMAIN_PROFILES[2];
  if (normalized.includes("cut.contentco-op.com")) return DOMAIN_PROFILES[3];
  if (normalized.includes("deliver.contentco-op.com")) return DOMAIN_PROFILES[4];
  return DOMAIN_PROFILES[1];
}

export function assistantOrigins() {
  return [
    "https://astrocleanings.com",
    "https://www.astrocleanings.com",
    "https://contentco-op.com",
    "https://www.contentco-op.com",
    "https://script.contentco-op.com",
    "https://co-script.contentco-op.com",
    "https://coscript.contentco-op.com",
    "https://cut.contentco-op.com",
    "https://co-cut.contentco-op.com",
    "https://deliver.contentco-op.com",
    "https://co-deliver.contentco-op.com",
    "https://codeliver.contentco-op.com",
    "https://coproof.contentco-op.com",
  ];
}
