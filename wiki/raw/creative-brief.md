---
title: Creative Brief System
created: 2026-04-30
updated: 2026-05-01
tags: [creative-brief, intake, ai, proposal, stripe, phase-3]
---

## Summary

The creative brief system is Content Co-op's primary inbound funnel. It captures client project requirements through a multi-step form, generates AI-enriched proposals, and handles deposit payments via Stripe. Currently in Phase 3 enhancement.

## Pages & Routes

| Route | File | Purpose |
|-------|------|---------|
| `/brief` | `app/brief/page.tsx` | Brief page shell |
| `/brief` (client) | `app/brief/brief-client.tsx` | 4-step form component |
| `POST /api/cco/briefs` | `api/cco/briefs/route.ts` | Brief intake (Firebase) |
| `POST /api/cco/leads` | `api/cco/leads/route.ts` | Lead capture |
| `POST /api/briefs` | `api/briefs/route.ts` | Legacy Supabase intake |
| `POST /api/briefs/[id]/quote-draft` | `api/briefs/[id]/quote-draft/route.ts` | Quote generation |

## Form Steps

### Step 1: Contact
- Name, email, phone
- Company, role, location
- Auto-saves lead snapshot to Firestore via `/api/cco/leads`

### Step 2: Project
- Content type (video, photo, animation, etc.)
- Deliverables (social cuts, hero video, etc.)
- Objective and key messages
- References and constraints

### Step 3: Scope
- Audience definition
- Tone and style
- Deadline and budget range
- Booking intent signal

### Step 4: Review
- Summary of all inputs
- "Get Your Estimate" CTA
- Success state with brief ID, booking URL, admin URL

## Data Flow

```
Client fills form
    ↓
POST /api/cco/leads (Step 1 advance)
    ↓
POST /api/cco/briefs (Submit)
    ↓
Firebase: people + organizations + relationships + auditEvents
    ↓
Firestore: creativeBriefs + handoffs + emailOutbox
    ↓
Blaze handoff → thank-you email + quote PDF + proposal PDF
    ↓
Booking URL generated
```

## AI Proposal Engine (Planned)

The aspirational AI proposal flow:

1. **Client clicks "Get Your Estimate"**
2. **Gemini API enrichment**: Brief data sent to Gemini for agency-level proposal generation
3. **Proposal rendered**: Chicago/NY agency-style proposal page
4. **Client reviews proposal** at `/client/quote/{id}`
5. **Stripe deposit**: 50% deposit to lock project
6. **Admin review gate**: CCO OS admin reviews (accept/modify/reject)
7. **User notification**: Email on admin decision
8. **Calendar reservation**: Auto-booked on deposit

### AI Enrichment Prompt

The Gemini prompt would include:
- Client industry and company size
- Content type and deliverables
- Budget range and deadline
- Creative references
- Content Co-op portfolio examples
- Pricing from `@contentco-op/pricing`

### Proposal Sections

1. Executive Summary
2. Creative Approach
3. Production Timeline
4. Investment Breakdown
5. Team Assignment
6. Next Steps

## Libraries

| File | Purpose |
|------|---------|
| `lib/creative-brief.ts` | Payload normalization & handoff envelope |
| `lib/creative-brief-quote-draft.ts` | Quote draft generation |
| `lib/creative-brief-proposal-pdf.ts` | Proposal PDF rendering |
| `lib/cco-admin-model.ts` | CCO intake transaction builder |
| `lib/email-sender.ts` | Transactional email via Blaze |
| `lib/pricing.ts` | Pricing estimation logic |

## Types

See [[types-system]] for full type definitions:
- `CreativeBriefFormData` — Legacy flat form
- `CreativeDiagnosticInput` — Structured diagnostic
- `CreativeBriefSubmissionPayloadV3` — Full v3 payload
- `CreativeBriefStructuredIntake` — Normalized intake
- `CreativeBriefHandoffEnvelope` — Handoff event

## CSS

`app/brief/page.module.css` includes:
- `.progressFill` — Gradient progress bar (`#4c8ef5 → #a78bf5 → #2dd4bf`)
- `.statusRail` — 4-step step indicator
- `.surface` — Glass-card gradient
- `.chip:hover`, `.chipActive` — Periwinkle accent states

## Inspiration

`~/Desktop/content-coop-brief/` contains prototypes:
- `creative-brief.html` — Minimal 3-step glass card
- `index.html` — Full React prototype with card-select, live pricing, print styles

## Current Status (Phase 3)

- ✅ Card-select UI concept
- ✅ Gradient progress bar CSS
- ✅ Status rail CSS
- 🔄 Card UI React wiring
- 🔄 Auto-save to Firestore
- 🔄 Live estimate preview
- ⏳ Gemini API integration
- ⏳ Proposal page
- ⏳ Admin review gate
- ⏳ Stripe deposit flow

## Related

- [[booking-system]] — Post-brief scheduling
- [[quote-invoice-system]] — Commercial pipeline
- [[client-portal]] — Client quote/invoice views
- [[types-system]] — Type definitions
- [[firebase-integration]] — Firestore backend
- [[stripe-integration]] — Payment processing
- [[rollout-plan]] — Phase 3 roadmap
