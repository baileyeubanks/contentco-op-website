# Public brief to Co-VideoPro bridge

Source-only plan, 2026-10-04. CCO base `0914ca3ef4a8d514fe96265a606735596c6559de`; reported CCO live `0f28fdd`; reported CVP live `715d9d6`. These are release-owner receipts, not a fresh production probe. Task19 operates locally on M2; no deployment or database change is included.

## Existing identity and authority

| Record | Existing binding and state | Source/evidence |
| --- | --- | --- |
| Public lead | CCO-DB `briokwdoonawhxisbydy`, `public.contacts.id`; lead receipt is separate from completed brief | `apps/home/lib/cco-public-intake.ts` |
| Canonical submitted brief | `public.creative_briefs.id` UUID, `company_account_id = content-co-op`, `data.contact_id`, `data.public_submission_id`; unique partial submission index. Allowed `status`: submitted, reviewed, in_progress, delivered, closed | `apps/home/app/api/cco/briefs/route.ts`; retained `task/evidence/cco-handoff-full-schema.json` |
| Estimate | `public.estimates.id`, `brief_id`, `business_unit = CC`, current `active_version_id`; both internal/client statuses approved, no superseding estimate | `apps/home/lib/cco-brief-production-handoff.ts` |
| Frozen scope | `public.estimate_versions.id`, estimate binding, immutable snapshot SHA; exact-version approved decision in `public.estimate_decisions` | `apps/home/lib/cvp-handoff.ts` |
| Commercial handoff | `public.commercial_handoffs` requires estimate/version IDs, unique `idempotency_key`, payload hash, CVP inquiry/project IDs, receipt | Same helper and retained catalog |
| CVP inquiry | `co_production.inquiries.id`, authenticated `owner_id`, nullable `project_id`, source/summary; new, triaged, qualified, converted, declined | Retained catalog; CVP inquiry routes |
| CVP workspace | `co_production.projects.id`, required authenticated owner/name; status active/archived/completed; stage inquiry/intake/development/preproduction/production/post/review/delivery/archived | Retained catalog; CVP `lib/data-authority.ts` and `app/api/projects/route.ts` |
| Discovery/direction/prep | `discovery_sessions.inquiry_id` → `discovery_answers.session_id`; append-only `briefs.project_id` versions and independent approval; `plan_items.project_id` with `meta.source_brief_id` | CVP `lib/projects/journey-repository.ts`, `journey-service.ts`, `journey.ts` at owner release-workspace source |

IDs above are existing field contracts. No customer/owner ID is inferred, and CCO contact IDs must not be substituted for CVP contact IDs. CVP project creation defaults to stage `post`; any future provisional creator must explicitly use `intake` through a reviewed transition. Existing commercial handoff explicitly uses `intake`.

## First implementable staff step

The cleared public-branch source already routes `createProjectFromBrief` through `handoffBriefToProduction`. The older live helper writes incompatible legacy `public.projects` columns; it is not a provisional CVP seam. Staff conversion in the inspected base is `POST /api/os/briefs/[id]/convert`, behind internal session policies, `workflow_intervene` **and** `quote_manage`, CCO scope checks, and audit. It requires a single approved frozen estimate and preserves retry/idempotency checks.

`BriefOpsPanel` currently shows only the returned project ID after this action. Add a CVP link only from a complete successful response whose canonical brief ID, schema-qualified project, commercial receipt IDs, and embedded commercial brief/estimate/version binding agree. Require `commercialRef.source = cco_os`, a matching default-package key `cco:<estimate-number>:v<positive-version>:A`, and matching well-formed `sha256:<64 lowercase hex>` payload hashes. These are existing backend receipt fields, not new linkage. Construct the destination as `https://co-videopro.com/projects/<UUID>`; ignore server-supplied URLs. Failed, partial, malformed, mismatched and legacy results offer no link. The same validated receipt on replay opens the same workspace. This adds navigation only; the existing action and all commercial writes stay unchanged.

The link describes a recorded workspace. It does not establish current CVP access, agreement/signature, deposit satisfaction, creative approval, or permission to activate production. Those states retain their separate authorities. Discovery remains writable only through CVP's authenticated producer/owner/project/team role checks; its commercial adapter still reports evidence unavailable.

## Exact provisional gap

The retained live catalog has **no canonical CCO brief column or unique brief linkage** on `co_production.inquiries` or `projects`, and no typed CVP project link on `public.creative_briefs`. The existing inquiry `source` is descriptive text with no uniqueness constraint. JSON `data`, `normalized_scope_metadata`, and `commercial_ref` can hold arbitrary values but do not establish an existing safe provisional link or uniqueness. The commercial receipt cannot be reused before approval because `estimate_id` and `estimate_version_id` are required. No undocumented JSON key, overloaded commercial receipt, copied contact UUID, or hash-derived cross-product identity is introduced.

Consequently, precommercial create/link remains blocked pending an owner-reviewed durable brief/inquiry/project mapping with uniqueness, ownership, conflict/replay behavior and adoption by the later commercial handoff. The current approved-version helper allocates its project by estimate version; blindly adding an early project would otherwise create a second workspace. Approval and payment states must not be used as substitutes for this mapping.

Once that mapping is agreed, the smallest future action is internal **Create/link discovery workspace**: re-read canonical CCO brief and company scope; validate approved existing CVP owner; atomically claim one provisional mapping; create inquiry/workspace at intake; record IDs and payload binding; recover interrupted/concurrent attempts without duplicating or overwriting; import intake as source material, never approved direction. Later commercial handoff must adopt that exact workspace after its independent gates. No automatic email, invitation, guest grant, agreement, payment or production activation belongs in this action.

## Claims and acceptance

Cleared new files: `apps/home/lib/cco-provisional-brief-contract.ts`, `apps/home/lib/__tests__/cco-provisional-brief-contract.test.ts`, this document. Root and CCO owner also cleared only `apps/home/app/os/marketing/briefs/[id]/brief-ops-panel.tsx` for receipt navigation. Notification repair's detail page, `os-marketing.ts`, email helper/tests are untouched; CVP cockpit/loading/shell and all CVP source are untouched.

Before integration: focused fail/pass response-contract tests, existing conversion/handoff regressions, source-rendered link/copy checks, scoped typecheck/lint and independent owner review. Release owners integrate against their respective release bases. Remaining live acceptance: authenticated staff action and replay, canonical saved receipt, CVP navigation/access, refresh behavior, and separate creative/agreement/signature/deposit evidence. No live acceptance is claimed by these local tests.

**Owner-confirmed release prerequisite:** Public `0914ca3` has the approved-production action and newer handoff backend. Live `0f28fdd` and the separately prepared `4403404` artifact do not. The CCO release owner must reconcile those prerequisites before carrying this panel to release. This four-file patch neither ports nor deploys that backend.
