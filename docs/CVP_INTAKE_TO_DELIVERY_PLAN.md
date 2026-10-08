# CVP Intake → Delivery Plan

**Scope:** Content Co-op (CCO). The creative brief at `contentco-op.com/brief` is
the single front door for new CCO work. This document records what the brief
does today (verified against code, CCO-DB, Gmail and Drive on 2026-10-02), what
is being fixed first, the target pipeline from inquiry to closed project, and
the repo consolidation that supports it.

Companion to `docs/CCO_OS_COMMERCIAL_HANDOFF.md` (the Schneider law: CCO OS is
the commercial authority; Co-VideoPro executes and cannot alter totals).

---

## 0. The intent, stated plainly

1. **One front door.** Every new CCO inquiry enters through `/brief`. A
   prospect fills it in and gets an immediate, credible estimate. No inquiry
   lives only in a Gmail thread.
2. **The operator is told the moment it lands.** Bailey receives an alert with
   the contact, scope, instant estimate and a one-click link into the operator
   queue. The brief is visible in that queue under an admin login.
3. **Every inquiry becomes a project.** Quote and approval are the first two
   stages of a project record, not a separate system. Deposit/invoice follow
   from the same frozen quote version.
4. **The project mirrors the Drive convention.** `Clients / <Client> /
   <YYYY.MM.DD>_<Event> / RAW · Edited · Delivered` is the shape the business
   already works in (see Schneider Electric → `2026.09.28_WEFTEC`). The system
   should create and track that folder, not replace it.
5. **AI assists at every stage, never decides money.** Draft quote, proposal
   narrative, call sheet, deliverables checklist, follow-up drafts. The
   operator approves; totals are frozen by CCO OS (Schneider law).
6. **Clients get a back end.** Token portal now; real accounts on
   `client.contentco-op.com` next, so a client sees brief → quote → approvals →
   deliveries in one place.
7. **Three products, not twenty-two repos.** ACS OS, CVP (Co-VideoPro + CCO
   OS), and their two public sites. Everything else is archived or merged.

---

## 1. What the brief does today (verified)

### 1.1 The happy path as coded

| Step | Where | Writes |
|---|---|---|
| Step 1 → leaves contact | `POST /api/cco/leads` | `contacts` (CCO-DB `briokwdoonawhxisbydy`, `business_unit = ['CC']`) |
| Submit | `POST /api/cco/briefs` | `creative_briefs` (flat columns + `data` envelope), `notification_log` × 2 |
| Emails | `lib/email-sender.ts` | operator alert → `bailey@contentco-op.com`; receipt → client. From `blaze@contentco-op.com` |
| Instant estimate | `POST /api/cco/briefs/proposal` | Gemini (`gemini-2.0-flash`) proposal stored in `creative_briefs.data.proposal`; totals from `lib/pricing.ts` |
| Portal | `/brief/proposal/[id]?token=` and `/portal/[id]?token=` | token-gated read |

Nothing else fires: no Hermes/Blaze call, no Slack/Telegram, no Drive folder,
no `events` row (fixed in this PR), no project.

### 1.2 Where the notification actually lands, and why it has not

The only operator notification is one email to `bailey@contentco-op.com`.
CCO-DB shows it has not been delivered since the August release:

| Brief | Date | Admin alert | Client receipt | Proposal stored |
|---|---|---|---|---|
| Codex live persistence test | 2026-08-22 01:45Z | failed | failed | no |
| Codex SHA verification | 2026-08-22 03:12Z | failed | failed | no |
| CCO Submit Test | 2026-08-27 14:16Z | failed | failed | no |

Error on every row:

```
FileNotFoundError: No such file or directory: '/Users/_mxappservice/.config/blaze/...'
```

Root cause: the live runtime on the M4 runs as `_mxappservice`, which has no
Gmail OAuth token file, and `RESEND_API_KEY` is unset. The Gmail path also
needs `python3`, which the Docker image does not ship. The April 9 test briefs
did deliver (two "Creative brief received" emails with quote + proposal PDFs
are in Gmail) because they went through the older Blaze path that has since
been retired.

Second-order effect: the client flow treated any email failure as a stop, so
**no proposal has ever been persisted for a public brief** (0 of 47 rows have
`data.proposal`). The "instant quote" moment never happened in production.

### 1.3 Pricing engines (three, unreconciled)

| Engine | Used by | Basis |
|---|---|---|
| `apps/home/lib/pricing.ts` | public live estimate, AI proposal totals | pre-pro $850–1,800; first half-day $2,600; post $1,400–3,400; multipliers; floor $2,500 |
| `lib/creative-brief-quote-draft.ts` | operator "Generate draft quote" | keyword base by `content_type` (brand 7,600 / exec 5,400 / social 3,200) |
| `lib/os-production-scope.ts` + `os-commercial-pipeline.ts` | canonical `estimates` | unit rate card in cents, scaled to a $6.5–8.5k default |

The real rate card lives outside the app (the `cco-quote` skill, July 2026):
Director/Producer day $2,750 (solo $3,000), Alex $1,250, event recap edit
$2,500, soundbites $200 each, admin/coordination $500, mileage $0.724/mi,
hotel ~$250–350/night, drone $500. Precedents: EPC $8,600; Automation Days
$9,425.80; WEFTEC 2026 $15,706.80. None of the three engines encode it.

Both operator engines read `structured_intake.recommendation / quote_signal`
keys the current form never writes, so they fall back to defaults and ignore
what the client entered.

### 1.4 Surfaces and names

- **CCO OS** = `admin.contentco-op.com/os/*` (this repo, `apps/home`). Commercial authority.
- **CVP = Co-VideoPro** = the `codeliver` repo (`package.json` name `co-videopro`). Creative production: review, approvals, locked delivery. Its canonical source is the local `cco-videopro-definitive-20260715` folder; GitHub `codeliver` is the mirror.
- **Mission Control** and **ROOT** are dead (`README.md`, `HOST_CUTOVER_CCO_OS.md`). Mission Control still has a parallel `/brief` intake writing a local JSON file; do not resurrect.

---

## 2. First fix (this PR)

Code, all in `apps/home`, all covered by tests (178 passing, typecheck clean):

1. **Operator alert roster is configurable and can only grow.**
   `bailey@contentco-op.com` is pinned; `CCO_ADMIN_ALERT_EMAILS` adds
   recipients. One `notification_log` row per recipient. Aggregate status is
   `sent` if anyone received it.
2. **The alert is useful.** It now carries phone, the rule-based instant
   estimate range, and a "Review in CCO OS" button to
   `/os/marketing/briefs/<id>`.
3. **A durable `brief_submitted` event is written** (`events` table,
   replayed by `type` + `payload.brief_id`). The idempotency key
   `brief_submitted:<brief_id>` is stored in payload and metadata because
   `public.events` has no `idempotency_key` column. Payload has
   `structured_intake` + estimate. `creative-brief-quote-draft.ts` already
   looks for exactly this event; it never existed before. Event failure never
   blocks the receipt.
4. **The estimate no longer depends on email.** The browser requests the
   proposal regardless of delivery outcome and shows "View your estimate" next
   to "Retry email delivery".
5. **Health reports the transport.** `/api/health` → `intake_contract` is
   `warn` with `emailTransport: none` when neither Resend nor a readable Gmail
   credential exists. Startup (`verify-runtime-env.mjs`) warns on the same.
6. **Migration (not applied):** `20261002120000_creative_briefs_status_converted.sql`
   adds `converted` to the `creative_briefs.status` check so brief → project
   conversion stops silently failing its final update.
7. Docs: runbook rewritten with the real diagnosis; API contract updated.

### 2.1 Host actions only Bailey can do (≈15 minutes on the M4)

1. Choose a transport for the `:4100` runtime user:
   - **Resend:** `RESEND_API_KEY=` in the runtime `.env.local` (verify
     `blaze@contentco-op.com` in Resend), or
   - **Gmail:** copy the token to
     `/Users/_mxappservice/.config/blaze/google/blaze_contentcoop.json`, or set
     `GOOGLE_OAUTH_TOKEN_FILE_BLAZE` to a path that user can read.
2. `CCO_ADMIN_ALERT_EMAILS=baileyeubanks@gmail.com` (ACS alerts already land
   there; add anyone else).
3. `GEMINI_API_KEY=` so proposals are real, not mocked.
4. `npm run publish:live`, then `curl .../api/health` and submit a `+test` brief.
5. Apply the `converted` migration to CCO-DB.

---

## 3. Target pipeline: one project record, ACS-style vocabulary

ACS OS proved the pattern: one record, named states, every transition proven.
CVP gets the same spine with production stages in the middle.

```
brief_submitted → estimate_shown → admin_review → quote_sent → client_approved
→ deposit_paid → project_opened → pre_production → shoot_scheduled
→ shoot_complete → post_in_progress → review_round → client_approved_final
→ delivered → invoiced → paid → closed
```

| Stage | Record | Surface | AI assist (proposes, never commits money) | Notify | Drive |
|---|---|---|---|---|---|
| brief_submitted | `creative_briefs`, `events` | `/brief`, `/os/marketing/briefs` | parse scope, flag missing inputs | operator alert (email now; Text via Hermes later) | — |
| estimate_shown | `creative_briefs.data.proposal` | `/brief/proposal/[id]` | Gemini narrative on rule-based totals | client receipt | — |
| admin_review | `estimates` v1 | `/os/marketing/briefs/[id]` | draft quote from rate card + precedents | — | — |
| quote_sent | `estimate_versions` (frozen), quote PDF | `/share/quote/[id]`, client portal | cover email draft in Bailey's voice | client | `00_Brief+Quote/` |
| client_approved | `estimate_decisions`, `approvals` | portal | — | operator | — |
| deposit_paid | `payment_attempts`, Stripe | `/api/cco/briefs/[id]/deposit` (re-enable) | — | operator + client | — |
| project_opened | `projects` (+ `co_production.projects` via handoff) | `/os/projects/[id]` | name, deliverables list from brief | operator | create `Clients/<Client>/<date>_<Event>/` |
| pre_production | `call_sheets`, `locations`, `releases` (CVP) | CVP `/field` | call sheet, shot list, release chase list | crew | `01_Pre-production/` |
| shoot_* | `production_days` | CVP | day-of checklist | crew, client | `02_RAW/` (BAILEY RAW, ALEX_RAW) |
| post_in_progress | CVP assets/versions | CVP | selects, transcript, soundbite picks | — | `03_Selects/`, `04_Edits/` |
| review_round | `review_view_admissions`, comments | CVP `/review/[token]` | summarize feedback into an edit list | client, editor | — |
| delivered | `deliverable_items`, locked | CVP delivery | delivery note draft | client | `05_Delivered/` |
| invoiced / paid | `invoices`, `invoice_payments` | CCO OS `/os/invoices` | reminder cadence | operator | — |
| closed | `projects.status` | CCO OS | recap for portfolio case study | — | archive |

Rules carried over from ACS: one record per inquiry (no duplicates across
Mission Control / CVP inquiries / CCO OS); every outbound message through the
shared `notification_log`/outbox; money only moves from CCO OS; crew surfaces
price-blind.

---

## 4. Drive as the project file system

Observed convention (Drive, bailey@contentco-op.com):

```
Clients/
  Schneider Electric/
    2026.06.16_EPC/              ← RAW .ARW files at top level
    2026.08.06_Automation Days/  ← BAILEY RAW, ALEX_RAW, Batch Edited_Photos
    2026.09.28_WEFTEC/           ← Edited Photos
```

Plan: on `project_opened`, CCO OS creates
`Clients/<Client>/<YYYY.MM.DD>_<Event>/` with the standard children
(`00_Brief+Quote`, `01_Pre-production`, `02_RAW/BAILEY RAW`, `02_RAW/ALEX_RAW`,
`03_Selects`, `04_Edits`, `05_Delivered`), stores the folder id on
`projects.metadata.drive_folder_id`, drops the quote PDF and brief PDF into
`00_Brief+Quote`, and links the folder from the operator and client portals.
Existing folders are adopted, not recreated. No file ever leaves Drive.

---

## 5. One rate card (landed in this PR)

`apps/home/lib/pricing.ts` is now the single rate-card module. It encodes the
real July 2026 card (Director/Producer $2,750 with a 2-person crew or $3,000
solo, Alex $1,250, main/recap edit $2,500, soundbites $200 × 5 per capture day,
selects $350/day, admin $500, pre-production $250/$500, drone $500, mileage
$0.724/mi, hotel $250/$350, airfare cap $800, discounted travel days $500,
rush 15%). `estimateFromRateCard` reproduces the accepted precedents exactly
and those are pinned as tests: EPC $8,600; Automation Days South $9,425.80;
WEFTEC 2026 $15,706.80; El Paso VOC shoot #2 $5,800.

Consumers now on the same module: the public live estimate, the AI proposal
totals, the operator alert, and the operator "Generate draft quote" (which
also stopped reading legacy keys the form never writes). The canonical
`estimates` engine (`os-production-scope.ts`) still carries its own unit
card; folding it onto `RATE_CARD` is the next step so the frozen quote and
the public range come from one place.

## 6. Client accounts

- **Now:** token portal (`/portal/[id]`, `/client/[token]`, `/share/quote/[id]`).
- **Next:** Supabase Auth with `app_metadata.content_coop_role = client` on
  `client.contentco-op.com` (already modelled in Co-VideoPro). Identity joins
  on `contacts.cco_public_email_key`, so a brief submitted anonymously becomes
  the client's first project when they claim the account.
- **Closed in this PR:** `/client/portal` resolves a contact only from
  `contacts.portal_token` (minimum 16 characters). A bare `?email=` is ignored,
  and the email form routes to `/book` for a fresh link.
- **Removed (G2, 2026-10-08):** `GET /api/client/portal` is deleted again,
  matching live since Sep 9 (190cb8b, CCO-ROUTE-GATE-001).

---

## 7. Mane Media

The Mane Media thread could not be read. The connected mailbox is
`baileyeubanks@gmail.com`; the work inbox `bailey@contentco-op.com` is not
connected, and no Gmail, Drive or meeting-notes search returned "Mane".
Forward the thread to the personal address or connect the work mailbox, and
this section gets filled in with: what they asked for, what the brief should
have captured, and the quote that would have been produced from §5.

---

## 8. Repo consolidation

Prior decisions (platform-ops 2026-03, contentco-op-website 2026-08,
platform-ops branch 2026-09) already settled most of this; the table applies
them.

### 8.1 Security first (do before any archiving)

| Repo | Finding | Action |
|---|---|---|
| `system-sync` (**public**) | `blaze/openclaw/openclaw.json` commits Telegram bot tokens and a gateway token | make private now, confirm revocation, then delete after salvaging audit docs |
| `root` | commits the CCO-DB service-role JWT (`netlify.toml`, `scripts/import_statements.py`) | rotate the key in Supabase, then archive |
| `contentco-op-website` | `GET /api/client/portal?email=` unauthenticated | route deleted (190cb8b on live; G2 PR on main) |
| CCO-DB | RLS disabled on `projects`, `assets`, `folders` | enable with policies before client accounts |

### 8.2 Keep

| Repo | Role |
|---|---|
| `astrocleanings-admin` | ACS OS |
| `acs-website` | ACS public site + quote engine |
| `contentco-op-website` | CCO public site + CCO OS (`/os`) |
| `codeliver` | Co-VideoPro (CVP). Rename the GitHub repo to `co-videopro` and sync from the definitive local folder |
| `platform-ops` | live control plane mirror; merge or close `codex/cloud-handoff-20260927`, banner March docs as historical |
| `ccnas-stack` | live deploy tooling; sync GitHub from the on-disk copy |

### 8.3 Merge then archive

| Repo | Into | What moves |
|---|---|---|
| `acs-onboarding` | `acs-website` | ES/PT module content, ElevenLabs audio, admin editors |
| `supabase-migrations` | `contentco-op-website/infra/supabase` | 16 unique CCO-DB migrations + ontology/RLS docs (check applied state first) |
| `coscript` | `codeliver` (or archive) | dormant since March; AI script lane belongs inside CVP |
| `coedit` (Co-Cut) | archive | dormant since March; CVP owns edit decisions; keep as reference |

### 8.4 Archive (read-only)

`aetherbooks` (never embedded; also stop its 15-minute health cron and
decommission CF Pages / Firebase / its Supabase project), `root`, `root-platform`,
`research`, `brand` (after confirming vendored token copies), `field-mobile`,
`ACS_CC_AUTOBOT`, `mission-control`.

### 8.5 Delete

`portfolio` (empty, public), `acs-website-git-ci` (empty), `acs-deploy` (stale
mirror), `system-sync` (after §8.1).

End state: 6 active repos.

---

## 9. Sequenced slices

| Slice | Outcome | Proof |
|---|---|---|
| **1 (this PR + host actions)** | Alert lands; client sees a rate-card estimate; `brief_submitted` event exists; client portal fails closed | `notification_log` rows `sent`; `has_proposal = true`; `/api/health` ok |
| **2 Operator queue** (partly landed) | `/os/marketing/briefs` no longer crashes on public briefs; the detail page shows production scope, the rate-card estimate, "generate draft quote" and "open project from brief". Still to do: badge count from `brief_submitted` events, reply-from-queue, Drive folder on open | one real brief → draft quote in < 2 min without leaving `/os` |
| **3 Project + money** | `project_opened` creates `projects` + Drive folder; quote → approval → deposit via existing CCO OS Stripe rail (`/api/cco/briefs/[id]/deposit` re-enabled); client portal shows it | one test brief to paid deposit with a frozen estimate version |
| **4 Production + delivery** | CCO OS → Co-VideoPro handoff (`commercial_handoffs` → `co_production.projects`) carries the frozen total; review/approval/locked delivery in CVP; invoice from the same version | WEFTEC-shaped project end to end on a test client |
| **5 AI along the way** | Hermes drafts: quote cover email, call sheet, release chase list, feedback summary, delivery note; operator approves each | drafts appear as proposals in the queue, never auto-send |
| **6 Consolidation** | §8 executed | GitHub shows 6 active repos; secrets rotated |

---

## 10. Open questions for Bailey

1. Resend or Gmail for the `:4100` runtime user?
2. Should the public estimate show a range (current) or a single number with
   "starting at"? The rate card supports either.
3. Does Co-Script survive as a lane inside CVP, or is it archived?
4. Who else is on the operator alert roster besides you?
5. Forward the Mane Media thread so §7 can be completed.
