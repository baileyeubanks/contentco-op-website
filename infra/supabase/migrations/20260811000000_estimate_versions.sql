-- Task 2.5 — immutable quote (estimate) versions.
--
-- Freeze-on-send: when an estimate is sent, its row + line items + totals are
-- frozen into estimate_versions and estimates.active_version_id points at the
-- frozen row. Client decisions, deposit invoices, Stripe amounts, PDFs, and
-- the Co-VideoPro handoff all read the frozen snapshot, never the live row.
-- Re-send after changes_requested mints version+1 on the same estimate row
-- (no superseded_by_estimate_id fork).
--
-- Depends on 20260411_root_commercial_pipeline.sql only.

create table if not exists estimate_versions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  version int not null check (version > 0),
  frozen_at timestamptz not null default now(),
  snapshot jsonb not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (estimate_id, version)
);

create index if not exists idx_estimate_versions_estimate
  on estimate_versions(estimate_id, version desc);

alter table estimates
  add column if not exists active_version_id uuid references estimate_versions(id) on delete set null;

create index if not exists idx_estimates_active_version
  on estimates(active_version_id) where active_version_id is not null;

alter table invoices
  add column if not exists estimate_version_id uuid references estimate_versions(id) on delete set null;

create index if not exists idx_invoices_estimate_version
  on invoices(estimate_version_id) where estimate_version_id is not null;

alter table estimate_decisions
  add column if not exists estimate_version_id uuid references estimate_versions(id) on delete set null;

create index if not exists idx_estimate_decisions_version
  on estimate_decisions(estimate_version_id) where estimate_version_id is not null;
