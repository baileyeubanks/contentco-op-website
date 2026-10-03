# CCO intake + RLS inventory — 2026-10-03

Read-only inventory for the CCO lane (constitution §6.4, §6.8, §9.3, §18.5,
§20.2). Every claim carries a label:

- **verified** — observed directly (file:line in this repo at `main`
  `af5d678`, or a read-only query against CCO-DB on 2026-10-03).
- **inferred** — follows from verified facts but was not observed end to end.
- **unknown** — could not be established from this seat.

Namespace: CCO / CVP only. ACS code, routes, credentials and the ACS Supabase
project were not read or referenced beyond noting that ACS files exist in this
repo's migration folder.

## 1. Repo layout

| Item | Evidence | Label |
| --- | --- | --- |
| This repo serves `contentco-op.com/brief`. | `ROUTE_MAP.md:28` (`/brief` → "writes through app API"); `apps/home/app/brief/page.tsx:1-10` renders `BriefClientPage`; `apps/home/app/brief/brief-client.tsx:468` posts to `/api/cco/briefs`. | verified |
| Monorepo: `apps/home` is the public site + CCO OS runtime; `apps/cocut`, `apps/coscript`, `apps/codeliver` are product apps; `packages/*`, `services/*`. | `package.json:9-13`; `README.md:5-9`. | verified |
| Supabase migrations live in two places: `infra/supabase/migrations/*.sql` (15 files) and `apps/home/supabase/migrations/*.sql` (2 files). | `ls` of both directories. | verified |
| Tests: 28 vitest files under `apps/home/lib/__tests__`, 169 tests, all passing on `main`. | `npx vitest run` in `apps/home` (baseline run this session). | verified |
| CI runs typecheck, lint and build only; **vitest is not run in CI**. | `.github/workflows/ci.yml:48-60`. | verified |
| `CCO CI Security` runs `npm audit --omit=dev --audit-level=high` and is red on `main` (1 critical, 7 high). | `.github/workflows/ci-security.yml:31`; `npm audit` baseline this session. | verified |
| `npm run ops:intake` points at `scripts/check-intake-readiness.mjs`, which does not exist. | `package.json:29`; `ls scripts/`. | verified |

## 2. Which Supabase project CCO uses (names only)

| Item | Evidence | Label |
| --- | --- | --- |
| CCO-DB project ref `briokwdoonawhxisbydy`, registry name "CCO OS". | `README.md:27`; `apps/home/lib/cco-public-intake.ts:18` pins the host and refuses any other project (`:296-321`). | verified |
| The public intake route builds its own service-role client bound to that host; the generic `apps/home/lib/supabase.ts:6-13` client is also service-role (`SUPABASE_SERVICE_KEY`). | file:line above. | verified |
| The browser-side anon client (`apps/home/lib/supabase-browser.ts`) is only used by `use-realtime-table-refresh.ts`, which is hard-disabled (`ENABLE_PUBLIC_ROOT_REALTIME = false`, line 6) and has no callers. The SSR cookie client (`supabase-server.ts`) is used only for auth (`platform-access.ts:61`, `api/os/login`, `auth/callback`, `dashboard/layout`). No app code reads CCO tables through anon/authenticated. | grep of imports this session. | verified |
| The live project list shows exactly two projects in the org: "ACS OS" (`cviggizfmelffvpfzkmh`) and "CCO OS" (`briokwdoonawhxisbydy`). Only the CCO project was queried. | Supabase MCP `list_projects` (read-only). | verified |

## 3. Public tables and RLS state

### 3a. As declared by this repo's migrations

| Migration | Tables | RLS declared | Policies declared | Label |
| --- | --- | --- | --- | --- |
| `20260224_content_coop_v21.sql` | orgs, org_members, org_invites, sessions, review_assets, asset_versions, timecoded_comments, approval_gates, approval_decisions, review_events, watchlists, watchlist_sources, source_videos, outlier_scores, briefs, script_jobs, script_variants, script_fixes, vault_items, media_assets, media_derivatives, thumbnail_candidates, thumbnail_approvals, usage_ledger, plan_limits, org_plan_subscriptions | **none** | none | verified |
| `20260225_onboarding_v1.sql` | creative_briefs, brief_status_history, brief_messages, brief_files | enabled (`:62-65`) | **none** (comment says "service role only") | verified |
| `20260226_coedit_v2.sql` | editing_projects, raw_uploads, soundbites, extraction_jobs | none | none | verified |
| `20260226_user_profiles.sql` | user_profiles | none | none | verified |
| `20260306_root_ops_core.sql` | work_claims, daily_handoffs, document_artifacts | none | none | verified |
| `20260317_root_ontology_core.sql` | businesses, contacts, events, quotes, quote_items, invoices, invoice_payments, contact_business_map | **none** | none | verified |
| `20260317_root_ontology_core.sql` | companies, relationships, opportunities, projects, deliverables, campaigns, campaign_contacts, payments, catalog_items, automation_rules, automation_runs | enabled (`:515-525`) | `service_role_<t>` **`for all using (true) with check (true)` with no `to` clause (`:529-539`) → applies to PUBLIC, i.e. anon and authenticated get full read/write/delete** | verified |
| `20260411_root_commercial_pipeline.sql` | brief_scope_items, estimates, estimate_line_items, estimate_decisions, approvals, approval_policies, payment_attempts, commercial_workflows | none | none | verified |
| `20260811000000_estimate_versions.sql`, `20260811000100_commercial_handoffs.sql` | estimate_versions, commercial_handoffs | none | none | verified |
| `20260822012747_cco_public_brief_persistence_20260819000000.sql` | notification_log | enabled (`:99`) | none | verified |
| `apps/home/supabase/migrations/*` | assistant_rate_limits, goals, agents, contact_import_batches, contact_import_rows | none | none | verified |
| ACS: `20260225_acs_v1.sql`, `20260225_job_applicants.sql` | acs_*, job_applicants | out of scope, not read beyond the grep that located them | — |

A scratch Postgres built from these files (ACS files excluded) has RLS
disabled on 57 CCO tables and open PUBLIC policies on 11 more. Proof:
`CCO_RLS_TEST_EXCLUDE=cco_rls_service_role_lockdown bash infra/supabase/tests/rls/run.sh`
fails with the full list. **verified**

### 3b. As observed live on CCO-DB (read-only, 2026-10-03)

| Observation | Evidence | Label |
| --- | --- | --- |
| Live CCO-DB has ~230 public tables; the repo declares ~75. The ontology layer (`companies`, `relationships`, `opportunities`, `deliverables`, `campaigns`, `campaign_contacts`, `automation_rules`, `automation_runs`), `editing_projects`, `raw_uploads`, `soundbites`, `extraction_jobs`, and the `apps/home/supabase` tables **do not exist live**. `20260317_root_ontology_core.sql` is absent from the live migration history. | `list_tables`, `list_migrations`. | verified |
| RLS is **disabled** live on `public.projects`, `public.assets`, `public.folders` (and `spatial_ref_sys`, a PostGIS system table). All three carry full INSERT/SELECT/UPDATE/DELETE grants to `anon` and `authenticated`. Owner-scoped policies exist on them but are inert while RLS is off. | security advisor `rls_disabled_in_public` + `policy_exists_rls_disabled`; `information_schema.role_table_grants`. | verified |
| Live `projects` is the Co-Deliver shape (`owner_id, name, org_id, …`), **not** the ontology shape the repo declares (`business_unit, title, …`). `apps/home/lib/os-projects-engine.ts` and `cvp-handoff.ts` write the ontology shape. | column listing. | verified (shape); inferred (OS writes fail live) |
| Live `contacts`, `events`, `notification_log`, `creative_briefs`, `quotes`, `invoices`, `payments`, `brief_*`, `businesses`, `sessions`, `catalog_items`, `quote_items`, `contact_business_map`, `invoice_payments` have RLS enabled with a `service_role_only_*` policy. These policies are **not in the repo** (hand-applied). `quotes` additionally has a live `anon_insert_quotes_public_intake` INSERT policy (ACS/CC public quote intake) which this lane leaves untouched. | `pg_policies` query. | verified |
| Live `contacts`, `events`, `notification_log` have had anon/authenticated table grants revoked; `creative_briefs` has **not** (anon holds full grants, RLS + service-role-only policy is the only barrier). | `role_table_grants`. | verified |
| Live `approvals`, `orgs`, `assets` use `get_jwt_role()`-based admin policies applied to PUBLIC. Not changed by this lane. | `pg_policies`. | verified |
| Security advisor totals: 1 `rls_disabled_in_public`, 1 `policy_exists_rls_disabled`, 1 `security_definer_view`, 1 `rls_enabled_no_policy` (INFO), 126 `auth_allow_anonymous_sign_ins` warnings, plus function/extension warnings. | `get_advisors(security)`. | verified |

## 4. Brief submission path, end to end

| Step | Code | Behaviour on `main` | Label |
| --- | --- | --- | --- |
| Page | `apps/home/app/brief/page.tsx` → `brief-client.tsx` | Step 0 posts the lead to `/api/cco/leads` (`:396`); final submit posts to `/api/cco/briefs` (`:468`) with a browser-stored `submissionId` as retry key (`cco-public-intake-client.ts:36-50`). | verified |
| Legacy | `apps/home/app/api/briefs/route.ts` | `POST /api/briefs` returns `410 Gone`. | verified |
| API | `apps/home/app/api/cco/briefs/route.ts` | CSRF origin check, 10/min rate limit, zod `BriefIntakeSchema`, then `persistCcoBrief`. Returns `persisted: true` only on `ok`. | verified |
| DB: lead | `cco-public-intake.ts:331-413` (`ensureCcoContact`) | Lookup by generated `contacts.cco_public_email_key` + `business_unit @> ['CC']`; insert or metadata-only update. | verified |
| DB: brief | `cco-public-intake.ts:766-900` | Replay by `data.public_submission_id`; email mismatch → `409 brief_submission_conflict`; insert `creative_briefs` with `company_account_id = content-co-op`, `data`, `intake_payload`, `structured_intake`, `handoff_payload`. | verified |
| DB: event | — | **No `events` row is written on `main`.** `handoff_payload.event_type = "public_brief_submitted"` is stored on the brief only (`:859-864`). OS readers query `events.type = 'brief_submitted'` with `payload.brief_id` (`os-marketing.ts:285-287`, `creative-brief-quote-draft.ts:20-24`). Live `events` has 54 `brief_submitted` rows, the newest 2026-04-09, all from the pre-August path; the three public briefs since 2026-08-22 have none. | verified |
| Alert | `cco-public-intake.ts:525-702` (`deliverLoggedEmail`) | One `notification_log` row per (brief, template, recipient): `sending` → `sent`/`failed`/`unknown`. Admin alert to `bailey@contentco-op.com` and client receipt sent via `sendTransactionalEmail` (Resend, else Gmail OAuth/DWD python child). | verified |
| Alert coupling | `cco-public-intake.ts:718-752` (`briefResponse`) | A failed/unknown **email** leaves `ok: true` with `notification.admin.status = failed`. A failed **notification_log write** returns `ok: false, persisted: true, retryable: true` (brief kept; browser told to retry). **Nothing deletes a brief; the "failed email erases the brief" report does not reproduce on `main`.** | verified |
| Live alert state | `notification_log` | All 6 public-intake rows since 2026-08-22 are `failed` with `FileNotFoundError` from the Gmail token path: the M4 runtime user has no token file and `RESEND_API_KEY` is unset. | verified (status/error prefix only; no bodies read) |
| Success without persistence | — | The browser requires `persisted === true` (`brief-client.tsx:514`) and the server sets it only after a `creative_briefs` receipt. **The "success without a persisted record" report does not reproduce on `main`**; what is missing is the durable event, not the row. | verified |

### 4a. Event schema mismatch (the reported `brief_submitted` insertion failure)

| Finding | Evidence | Label |
| --- | --- | --- |
| Live `public.events` columns: id, contact_id, business_id, type, payload, created_at, processed_at, processed_by, process_error, attempts, event_version, business_unit (default `'ACS'`), channel (default `'legacy'`), direction, external_thread_id, text, metadata, received_at, processing_state (default `'queued'`), locked_by, locked_at, decision_id, idempotency_key. Check: `business_unit in ('ACS','CC')`. Index `idx_events_idempotency_key` is **non-unique**. | `information_schema.columns`, `pg_indexes`, `pg_constraint`. | verified |
| The repo declares `events` without `idempotency_key`/`event_version`, and adds `object_type`, `object_id`, `event_category` inside `exception when others then null` (`20260317_root_ontology_core.sql:389-396`). Those three columns are **absent live**. | column listing. | verified |
| `apps/home/lib/os-event-log.ts:93-108` (`emitTypedEvent`) inserts `object_type`, `object_id`, `event_category` → rejected on live CCO-DB (unknown column), error swallowed. | code + live columns. | verified (columns); inferred (runtime effect) |
| PR #2 (closed, merged into PR #1's branch) asserted `idempotency_key`/`event_version` are not live columns. **They are.** PR #2's reading was source-only. | PR #2 body vs live columns. | verified |

## 5. Known reports: verdicts

| Report | Verdict | Evidence |
| --- | --- | --- |
| Public CCO tables with RLS disabled or insufficient | **Confirmed in source** (57 tables no RLS, 11 with open PUBLIC policies). **Partially confirmed live**: `projects`, `assets`, `folders` RLS off with anon grants; most other CCO tables were hand-locked outside the repo. | §3 |
| Durable-event schema mismatch preventing `brief_submitted` | **Confirmed**, with a different root cause than reported: `main` never writes the event at all; the OS typed-event writer targets columns live lacks. | §4a |
| Converted-status migration prerequisite | **Confirmed**: `os-projects-engine.ts:270` writes `status = 'converted'`; live check constraint allows only submitted/reviewed/in_progress/delivered/closed. | `pg_constraint` |
| Public brief page shows success without a persisted record | **Not reproduced** on `main` (browser gates on `persisted: true`). | §4 |
| Operator alert logging coupled to persistence so a failed email could erase the brief | **Not reproduced**: no delete path exists; a failed email yields `notification.admin.status = failed` with the brief intact. The real defect is that email is attempted before the OS-facing event exists. | §4 |
| Portal `.eq()` filtering problem | **Confirmed**: `apps/home/app/api/client/portal/route.ts:8-30` and `apps/home/app/client/portal/page.tsx:7-25` resolve a contact by bare `?email=`/`?contact_id=` with the service-role client, no secret, and return quotes, jobs, invoices, payments (page: + conversations). The tokenized brief portal (`portal/[id]` with `access_token`) is fine. | file:line |
| M4 intake-email temp-file ownership | **Not in this repo's `main`**: email is sent from a python child spawned with `cwd = $HOME` reading `~/.config/blaze/google/*.json` (`email-sender.ts:3-5, 270-298`). No temp file is written. The ownership problem is the host runtime user lacking that token file (see live `FileNotFoundError`). PR #1's `m4-fix-intake-email.sh` is host tooling, not merged. | file:line; PR #1 body |
| `npm audit` gate | **Confirmed red on `main`**: `next` ≤ 16.3.5 critical (GHSA-p293-qw3h-jr36 and two more), `sharp` < 0.35.4 high, `qs` moderate, `uuid` via `firebase-admin` moderate. Lockfile has `next` 16.2.12. | `npm audit` this session |
| PR #1 partially complete | **Confirmed open** (draft, 9 commits, 25 files, mergeable_state `unstable`). It adds the event, alert roster, pricing, portal token fix and more. Its portal fix uses `contacts.portal_token`, which **does not exist live** (column listing). This lane does not duplicate PR #1; it lands the RLS/event/portal fail-closed layer on `main` with the same event shape so the branches reconcile. | GitHub PR read |
| `next` 16.3.8 / `@grpc/grpc-js` override | **Unknown provenance**: no such pin exists in `main` (`next` ^16.2.6, `@grpc/grpc-js` 1.14.4 transitive, no override). See §7. | `package.json`, lockfile |

## 6. Decisions reserved for Bailey (nothing below was executed)

1. Apply `20261003000000_cco_rls_service_role_lockdown.sql` to CCO-DB.
2. Apply `20261003000100_events_brief_submitted_contract.sql` to CCO-DB (adds the three typed-event columns live lacks; adds the unique partial index).
3. Apply `20261003000200_cco_codeliver_project_tables_rls.sql` **only after** Blaze verifies Co-Deliver read paths; it activates owner-scoped RLS on `projects`/`assets`/`folders`.
4. Apply `20261002120000_creative_briefs_status_converted.sql` (identical to PR #1's file).
5. Any email send: the admin alert and client receipt are pre-existing sends on `main`; this lane adds no new send and changes no recipient.
6. Dependency bump for the audit gate (§7).

## 7. Dependency state (step 5; nothing bumped by this inventory)

`npm audit --omit=dev` on `main`: 18 vulnerabilities (10 moderate, 7 high, 1 critical). `npm audit fix --dry-run` reports it would resolve `next`, `sharp`, `qs` and transitive packages within current semver ranges; `uuid` (via `firebase-admin`) needs `--force`/major. A version bump proves nothing about intake behaviour; the proof for that is the tests in this PR.
