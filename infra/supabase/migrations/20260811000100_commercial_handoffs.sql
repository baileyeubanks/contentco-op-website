-- Task 4.1 — commercial handoff receipts (accepted package → Co-VideoPro).
--
-- Stores the idempotent receipt for the CCO OS → Co-VideoPro seam: one row
-- per (estimate_version, variant) handoff. The unique idempotency key
-- (cco:<pkg>:v<n>:<variant>) is the guard against duplicate co_production
-- writes on retry; payload_hash detects the same key being reused for a
-- different accepted package.
--
-- Depends on 20260811_estimate_versions.sql (FK to estimate_versions).

create table if not exists commercial_handoffs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  estimate_version_id uuid not null references estimate_versions(id) on delete restrict,
  idempotency_key text not null unique,
  payload_hash text not null check (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  cvp_inquiry_id uuid,
  cvp_project_id uuid,
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_handoffs_estimate
  on commercial_handoffs(estimate_id, created_at desc);
create index if not exists idx_commercial_handoffs_version
  on commercial_handoffs(estimate_version_id);
