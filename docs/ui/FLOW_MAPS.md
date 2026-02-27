# Content Co-op Product Flow Maps

Last updated: 2026-02-24

## Purpose

Define exact user flows for three surfaces so UI implementation maps directly to operational behavior.

## 1) Surface: Content Co-op (Public Landing)

Primary goal: convert qualified visitors into invited users or discovery calls.

Flow:

1. Visitor lands on `/`.
2. Reads value proposition and capability split (`Co-Edit`, `Co-Script`).
3. Chooses one path:
   1. `Request Invite` -> `/login` with invite intent.
   2. `Enter Co-Edit` -> `/co-edit/dashboard` (gated).
   3. `Open Co-Script` -> `/co-script/studio` (gated).
4. If unauthenticated on gated routes -> redirect to `/login`.

Required UI states:

1. Hero with clear hierarchy.
2. Capability strip that explains the split between Co-Edit and Co-Script.
3. Trust block (security/integration/workflow signals).
4. Single primary conversion CTA in each major section.

## 2) Surface: Co-Edit (Wipster-class review workflow)

Primary goal: convert source signal into review-ready, decision-ready creative assets.

Flow:

1. User enters `/co-edit/dashboard`.
2. User reviews watchlist sync status.
3. User opens outlier list and applies filters.
4. User selects high-signal video(s).
5. User saves patterns to Vault.
6. User attaches vault/video items to project.
7. User adds review note/action.
8. Optional handoff to Co-Script for script generation.

State transitions:

1. `watchlist_source.status`: queued -> running -> synced|error
2. `vault_item`: unsaved -> saved
3. `project_video`: detached -> attached
4. `project_note`: none -> created

System actions:

1. Trigger watchlist sync.
2. Persist outlier scores and explanation.
3. Record vault/project links.
4. Write usage ledger for expensive operations.

## 3) Surface: Co-Script (Sandcastles-class script engine)

Primary goal: generate publish-ready scripts with iterative refinement and traceable history.

Flow:

1. User enters `/co-script/studio`.
2. User provides structured brief:
   1. script type
   2. objective
   3. audience
   4. constraints
   5. optional source context
3. User triggers `Generate`.
4. System returns variant set.
5. User selects variant and requests `Fix` or `Rewrite`.
6. System saves version history and feedback linkage.
7. User exports final draft to downstream ops.

State transitions:

1. `script_job.status`: queued -> running -> completed|failed
2. `script_feedback.status`: open -> addressed
3. `co_edit_document_versions`: n -> n+1

System actions:

1. Track usage ledger per generation/fix/variants call.
2. Preserve source context and prompt metadata.
3. Keep script version lineage immutable.

## 4) Auth and Access Flow (Internal + Invited)

Flow:

1. User reaches `/login`.
2. User authenticates.
3. Backend resolves org membership.
4. If membership exists -> access granted.
5. If invite pending -> prompt invite accept flow.
6. If no invite/membership -> deny with request-access path.

Guardrails:

1. `/co-edit/*` and `/co-script/*` require session + org membership.
2. Public landing never exposes service-role operations.
3. Session expiration returns user to `/login` with return path.

## 5) High-Risk Failure Modes

1. Split-pipeline UX:
   1. Co-Edit and Co-Script diverge in data model or identity.
2. Ambiguous source lineage:
   1. Script outputs not traceable to selected source context.
3. Noisy workflows:
   1. Too many controls before first useful outcome.
4. Unclear completion:
   1. User cannot tell if sync/generation succeeded or failed.

Mitigations:

1. Shared org/session model.
2. Unified usage + event logging.
3. Deterministic status chips and progress markers.
4. Error states with actionable retry paths.

## 6) Build Priorities for Next Pass

1. Co-Edit dashboard information architecture (status -> outliers -> vault -> projects).
2. Co-Script structured input panel and output variants panel.
3. Shared component primitives for list/table/card/form.
4. Visual and motion refinement layer after workflow completeness.

