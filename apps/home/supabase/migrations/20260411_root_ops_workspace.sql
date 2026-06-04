create extension if not exists pgcrypto;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  business_scope text not null default 'SHARED',
  success_criteria text not null,
  priority integer not null default 3,
  target_surface text not null default 'Root',
  deadline timestamptz null,
  approval_policy text not null default 'review',
  runtime_sensitive boolean not null default false,
  owner_type text not null default 'human',
  owner text null,
  status text not null default 'planned',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_business_scope_idx on public.goals (business_scope);
create index if not exists goals_status_idx on public.goals (status);
create index if not exists goals_runtime_sensitive_idx on public.goals (runtime_sensitive);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_scope text not null default 'SHARED',
  owner_type text not null default 'agent',
  approval_policy text not null default 'review',
  runtime_sensitive boolean not null default false,
  target_surface text not null default 'Root',
  priority integer not null default 3,
  status text not null default 'idle',
  summary text not null,
  capabilities jsonb not null default '[]'::jsonb,
  active_goal_count integer not null default 0,
  active_claim_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_business_scope_idx on public.agents (business_scope);
create index if not exists agents_status_idx on public.agents (status);
create index if not exists agents_runtime_sensitive_idx on public.agents (runtime_sensitive);

create table if not exists public.contact_import_batches (
  id text primary key,
  source text not null,
  business_scope text not null default 'CROSS',
  status text not null default 'processing',
  source_ref text null,
  total_rows integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_import_batches_created_at_idx on public.contact_import_batches (created_at desc);
create index if not exists contact_import_batches_scope_idx on public.contact_import_batches (business_scope);

create table if not exists public.contact_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references public.contact_import_batches(id) on delete cascade,
  contact_id uuid null,
  status text not null default 'imported',
  duplicate_match_id uuid null,
  review_summary text null,
  source_row jsonb not null default '{}'::jsonb,
  normalized_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contact_import_rows_batch_idx on public.contact_import_rows (batch_id);
create index if not exists contact_import_rows_contact_idx on public.contact_import_rows (contact_id);
