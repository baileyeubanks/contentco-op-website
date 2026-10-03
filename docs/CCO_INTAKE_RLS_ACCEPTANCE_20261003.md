# CCO intake + RLS acceptance mapping — 2026-10-03

Companion to `CCO_INTAKE_RLS_INVENTORY_20261003.md`. Every change on branch
`claude/cco-intake-rls-20261003` is listed with the proof that exercises it
and who verifies what. Nothing here was applied to a live database, sent, or
deployed.

The constitution text (Full Intent v2 §20.2 steps 1–13) lives in
`baileyeubanks/platform-ops`, which is not attached to this session, so the
step numbers below are **the reviewer's to bind**: each row names the
acceptance property it proves so it can be matched to the §20.2 step that
asks for it.

## A. Lane order and state

| Lane step | State | Proof path |
| --- | --- | --- |
| 1. Read-only inventory | DONE | `docs/CCO_INTAKE_RLS_INVENTORY_20261003.md` (file:line + live read-only evidence, labelled) |
| 2. RLS first: migrations + tests | DONE (source-only; apply is Bailey's) | `infra/supabase/migrations/20261003000000_cco_rls_service_role_lockdown.sql`; `20261003000200_cco_codeliver_project_tables_rls.sql` (flagged); `infra/supabase/tests/rls/run.sh` (scratch Postgres, passes; fails without the migration); `apps/home/lib/__tests__/cco-rls-migration-contract.test.ts` |
| 3. Intake integrity | DONE | `apps/home/lib/cco-public-intake.ts` (`ensureBriefSubmittedEvent`, ordered receipts); `20261003000100_events_brief_submitted_contract.sql`; `20261002120000_creative_briefs_status_converted.sql`; `apps/home/lib/__tests__/cco-public-intake-event.test.ts` (6 tests) |
| 4. Portal filtering / temp-file ownership | DONE (portal) / NOT IN CODE (temp file) | `apps/home/app/api/client/portal/route.ts`, `apps/home/app/client/portal/page.tsx`, `portal-view.tsx`; `cco-client-portal-route.test.ts`. The temp-file report maps to host token-file ownership on M4, not to any file in `main` (inventory §5). |
| 5. Dependency work | see PR body (last step; outcome recorded there) | `npm audit --omit=dev --audit-level=high` |

## B. Acceptance properties and their proofs

| # | Property | How it is proven | Verified by |
| --- | --- | --- | --- |
| P1 | Every CCO table declared by the repo has RLS enabled. | `infra/supabase/tests/rls/assertions.sql` §1 raises on any CCO table with `relrowsecurity = false`; negative run with `CCO_RLS_TEST_EXCLUDE=cco_rls_service_role_lockdown` lists 57 tables. | CI `db-contract` job; Blaze live after apply (`get_advisors` security must show no `rls_disabled_in_public` for CCO tables) |
| P2 | No policy grants PUBLIC or anon unconditional access. | `assertions.sql` §1 third check; `cco-rls-migration-contract.test.ts` "never widens access". | CI; Blaze live (`pg_policies` where roles = `{public}` and qual = true must be empty for CCO tables) |
| P3 | The authorized path (service_role) can perform the whole intake write set. | `assertions.sql` §2 inserts contact, brief, event, notification_log as `service_role`; brief status trigger fires. | CI |
| P4 | The unauthorized path (anon, authenticated) reads zero rows and cannot write. | `assertions.sql` §3 per role; data written in §2 survives. | CI; Blaze live: `curl` the PostgREST endpoint for `creative_briefs` with the anon key must return `[]` and an insert must 401/403 |
| P5 | Public brief success implies contact + brief + `brief_submitted` event are durable. | `cco-public-intake-event.test.ts` "success requires contact, brief and event"; insert order asserted (`contacts`, `creative_briefs`, `events`, then email). | Blaze live after deploy: submit a test brief, confirm one `events` row with `idempotency_key = cco_public_brief_submitted:<id>` |
| P6 | Event write failure is an honest, retryable state; a retry completes only the missing steps. | same file: "event write failure is an honest retryable state"; "replayed brief never duplicates its event"; "concurrent retry … resolves to the stored event". | Blaze (optional): block `events` insert in a staging copy and observe `503 brief_event_write_failed`, then success on retry |
| P7 | The event insert uses only columns that exist on live CCO-DB. | Fake DB rejects unknown `events` columns; `BRIEF_SUBMITTED_EVENT_COLUMNS` checked against the migration by `cco-rls-migration-contract.test.ts`. Live columns verified 2026-10-03 (inventory §4a). | Blaze live |
| P8 | Exactly one `brief_submitted` event per public brief, enforced by the database. | `assertions.sql` §2 duplicate insert raises `unique_violation`; negative run without `events_brief_submitted_contract` fails. | CI; Bailey apply |
| P9 | Operator alert state is logged separately and never gates or withdraws the brief. | `cco-public-intake-event.test.ts` "operator alert state is logged separately"; route returns `event` and `notification` as separate fields. | Blaze live: `notification_log` row per template with `failed`/`sent`, brief and event intact |
| P10 | No new email send and no recipient change. | `git diff main -- apps/home/lib/cco-public-intake.ts` touches no `sendEmail` call site, template, or recipient constant. | Reviewer |
| P11 | Client portal cannot be read with a bare email or contact id. | `cco-client-portal-route.test.ts`: handler takes no input, returns 410, never touches the database. | Blaze live: `GET /api/client/portal?email=…` → 410; `/client/portal?email=…` renders the request-a-link page |
| P12 | `creative_briefs.status = 'converted'` is accepted after apply. | `assertions.sql` final update; migration identical to PR #1. | Bailey apply; Blaze live |
| P13 | Repo checks are green and tests now run in CI. | typecheck clean; lint 0 errors (69 pre-existing warnings); vitest 31 files / 184 tests; `ci.yml` gains `Unit tests` step and `db-contract` job. | CI on the PR |

## C. Reserved for Bailey (nothing executed)

1. Apply migrations `20261003000000`, `20261003000100`, `20261002120000` to CCO-DB.
2. Apply `20261003000200` only after Blaze verifies Co-Deliver read paths.
3. Any dependency bump that changes `next` (see PR body for the attempted scope).
4. Credentials: this container cannot reach the M4/M2 env files or vaults; the
   build needs none (CI placeholders). `ACS_WEBSITE_CHECKOUT_TOKEN` is ACS
   namespace and is not handled in this lane.
5. Live Stripe, charges, refunds, secret rotation, client or crew messages:
   untouched.
