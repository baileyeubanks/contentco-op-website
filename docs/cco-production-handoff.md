# CCO approved commercial handoff to production

This repair uses the tables already present in the CCO database. It does not move or rename tables, change grants, or convert the 6 legacy public projects into the 3 production projects. The October 3, 2026 inventory contains 47 submitted briefs and no estimates, frozen versions, or commercial receipts. Those briefs therefore correctly return an actionable blocked result until their commercial approval prerequisites exist.

## Authority and contract

- Commercial records remain in `public`: `creative_briefs`, `contacts`, `estimates`, `estimate_versions`, `estimate_decisions`, `commercial_handoffs`, and `events`.
- Production uses a dedicated `co_production` client in the same pinned CCO Supabase project. The global client/schema is unchanged. Production rows use `projects.name`, `status=active`, `stage=intake`, and `deliverables.name/spec/status=specced`.
- Brief conversion resolves the persisted `estimates.brief_id` using the canonical UUID returned by PostgreSQL. It requires exactly one non-superseded CC estimate with both approval statuses and an active version. A conflicting normalized estimate hint or multiple qualifying estimates requires reconciliation. Legacy quotes, AI drafts, names, and email matches cannot establish approval.
- The shared handoff seam also checks the company scope of any saved linked brief, including calls through the direct estimate route. The applied `estimates.brief_id` column is NOT NULL; a missing saved brief link blocks handoff. The handoff checks exact estimate/version/brief/business bindings, snapshot hash, frozen timestamp, approved decision bound to that version, and the configured `CVP_OWNER_USER_ID`. The frozen snapshot supplies client identity, totals, and post-production deliverable scope items. Quantity stays explicit in `spec`; travel and other pricing lines do not become deliverables. `source_version_id` is left alone because it references a CVP media version, not an estimate version.
- Brief route access retains `workflow_intervene` and also requires the existing commercial `quote_manage` permission. No role receives new permissions.
- A version has one production project and inquiry, enforced by the existing unique partial indexes. Stable UUIDs also protect organizations, contacts, deliverables, event, and receipt from duplicate retries. Variant A is the supported package; another variant needs a separately approved version under this applied uniqueness contract.
- Same owner/email with another organization blocks before writes. Existing mutable production fields are not overwritten. Existing commercial links without the expected hash require reconciliation rather than adopting or replacing unknown work.
- Failures carry `stage`, `retryable`, `partial`, saved IDs, and an operator action. The receipt is saved last. A failed receipt write cannot produce success. Retrying resumes deterministic records; completed receipt replays verify links without writes or resetting later production decisions. Deleted completed deliverables and removed/reassigned inquiry links require reconciliation rather than restoration. Incomplete inquiries with later operator decisions block before further writes; the initial link update compares owner, commercial bindings, new status, and an unlinked project before writing. A concurrent winner is accepted only when the reloaded commercial link and converted state agree.
- Completion is the receipt and its qualified production link. The brief's applied status constraint has no `converted` value, so this action does not write a new brief status. Event object links live inside `payload`, matching the actual event table.

## Exact migration and rollout scope

**Required production migration: none (zero DDL, zero data migration).** No migration-history entry should be marked as applied for this repair. Existing columns, primary keys, project/inquiry version uniqueness, receipt uniqueness, and schema exposure support the adapter. The API catalog already lists `co_production` as exposed; runtime schema-cache/auth behavior still needs verification.

**Do not run `supabase db push`, apply pending ontology migrations, or apply the old creative-brief `converted` status migration as part of this rollout.** In particular, the applied `public.projects` table is the legacy production shape, not the shape assumed by older unrun migration files. Do not rename, copy, move, backfill, reparent, or delete any legacy or production records. Do not apply the isolated test fixture to any existing database.

The deployable code scope is the brief resolver, existing CVP handoff seam, the two existing handoff routes, and the brief operator feedback. The previous public-intake retry repair is retained in the branch history. Deploy only a reviewed exact source commit through the existing process after approval; this document authorizes no deploy. There is no new endpoint, subscription, credential, or global client setting.

Before enabling a live handoff:

1. Run the read-only catalog preflight in `docs/sql/cco-handoff-preflight.sql` and compare with the captured metadata. Stop on drift; prepare an exact separately reviewed change if a required constraint is absent. Do not substitute broad migration application.
2. Confirm runtime CCO binding and existing service-role access without printing values. Confirm `CVP_OWNER_USER_ID` is the intended existing production owner's canonical UUID and references an existing `auth.users` identity. The inspected original local `.env.local` did **not** contain this setting; that observation says nothing about deployed/process environment. Never substitute the request actor or invent an owner.
3. Resolve real approved commercial prerequisites through the existing authorized workflow. No estimate is automatically generated, approved, frozen, or sent by this action. The captured zero-estimate state is a release blocker for a real positive handoff, not a reason to manufacture business records.
4. Verify route denial for insufficient permission and a missing-estimate blocked response without writes in the intended runtime. Any positive production smoke test needs a specifically approved estimate and owner. Confirm the stored receipt, project/inquiry IDs, frozen totals, deliverable specs, and unchanged baseline records. Use the existing `getRuntimeProof`/deployment proof process; do not add another proof endpoint.
5. Review the independent security approval packet separately (`evidence/cco-security-approval-plan.md` in the task workspace, outside this source checkout). This repair makes no RLS, role, grant, or API exposure changes. Existing legacy public-project access risk and authenticated production UPDATE/deliverable grant questions remain separate decisions.

Rollback is code-only to the previous reviewed release **with both handoff actions disabled or withheld**; do not re-enable the old schema-incompatible conversion. Keep any partial or completed records and receipts for reconciliation. Do not delete records or reverse dependency links. Reapplying the reviewed repair must resume the same IDs. There is no SQL rollback because there is no SQL migration.

## Verification and limits

Run from the repository root:

```sh
npm ci --prefix apps/home/test-postgres --ignore-scripts --no-audit --no-fund
npm run test:postgres --workspace @contentco-op/home
npm run test --workspace @contentco-op/home -- --maxWorkers=1
npm run typecheck --workspace @contentco-op/home
```

The test-only nested package pins official `@electric-sql/pglite` 0.5.8 and `@electric-sql/pglite-pgvector` 0.0.9 in its own lockfile. It is not a production dependency. See [PGlite documentation](https://pglite.dev/docs/) and [extension documentation](https://pglite.dev/extensions/). No test loads production credentials or contacts a database. Existing local root dependencies were reused: Next 16.1.6, React 19.2.3, Vitest 4.1.4. The source manifest requests Next ^16.3.8; clean CI installation from the repository lockfile remains necessary. No heavyweight Next build was run while the Mac's creative export work was active.

`apps/home/test-postgres/applied-schema.json` contains reviewed catalog metadata, no customer rows, captured from the task evidence files `cco-handoff-full-schema.json`, `cco-estimate-decision-schema.json`, and legacy project/event metadata. `generate-fixture.mjs` deterministically creates `applied-schema.sql` from it. PGlite 0.5.8 runs PostgreSQL 18.3; the captured live database is PostgreSQL 17.6. This is an explicit major-version difference, not an exact runtime replica. Actual PostgreSQL checks execute inside isolated PGlite with pgcrypto, uuid-ossp, and vector. Assertions cover UUID aliases, applied FKs/checks/uniqueness, concurrent calls, injected failures and lost responses, immutable approved scope, contact conflicts, completed replays, and preservation of synthetic 6/3/47 records plus project dependencies. Route tests separately cover permission denial and honest partial HTTP results. Existing intake delivery/retry tests remain in the home suite.

Fixture limits are explicit: auth users, unrelated FK parent tables, and public contacts are ID-only stand-ins; asset/script dependency sentinels retain captured project FK behavior rather than their full unrelated payload schemas. The brief generated `fts` expression was not returned in the catalog capture and is omitted along with its index. RLS, trigger code, grants, GoTrue, PostgREST schema-cache/serialization, and real multi-backend transactions are not reproduced. PGlite executes actual PostgreSQL statements/constraints over one connection; async concurrent calls prove this adapter's deterministic interleaving behavior, not independent-backend stress behavior. Live API and role smoke checks remain gated on approval and prerequisites.
