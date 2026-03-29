create extension if not exists pgcrypto;

create table if not exists work_claims (
  id uuid primary key default gen_random_uuid(),
  task_key text not null,
  title text not null,
  repo text not null,
  machine text not null,
  owner text not null,
  status text not null default 'active',
  notes text,
  claimed_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_key, status) deferrable initially immediate
);

create index if not exists idx_work_claims_active on work_claims (claimed_at desc) where released_at is null;

create table if not exists daily_handoffs (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  machine text not null,
  title text not null,
  summary text not null,
  blockers text[] default '{}',
  next_actions text[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_handoffs_created_at on daily_handoffs (created_at desc);

create table if not exists document_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid,
  business_unit text not null,
  document_type text not null,
  version_label text,
  storage_path text,
  render_status text not null default 'rendered',
  outcome_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_artifacts_business_created_at on document_artifacts (business_unit, created_at desc);
