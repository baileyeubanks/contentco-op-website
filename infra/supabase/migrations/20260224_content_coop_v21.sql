create extension if not exists pgcrypto;

-- identity and access
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  role text not null,
  invite_token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- co-edit
create table if not exists review_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_name text not null,
  title text not null,
  status text not null default 'in_review',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references review_assets(id) on delete cascade,
  version_number int not null,
  media_asset_id uuid,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique (asset_id, version_number)
);

create table if not exists timecoded_comments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references review_assets(id) on delete cascade,
  version_id uuid references asset_versions(id) on delete set null,
  author_id uuid,
  timecode text not null,
  body text not null,
  state text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approval_gates (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references review_assets(id) on delete cascade,
  role_required text not null,
  gate_order int not null default 1,
  state text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists approval_decisions (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references approval_gates(id) on delete cascade,
  decided_by uuid,
  decision text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists review_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references review_assets(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- co-script
create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists watchlist_sources (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  source_type text not null, -- youtube_channel | tiktok_creator
  source_external_id text not null,
  created_at timestamptz not null default now(),
  unique (watchlist_id, source_type, source_external_id)
);

create table if not exists source_videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  source_type text not null,
  source_video_id text not null,
  source_url text,
  title text not null,
  transcript text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, source_type, source_video_id)
);

create table if not exists outlier_scores (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid not null references source_videos(id) on delete cascade,
  score numeric not null default 0,
  score_reason text,
  created_at timestamptz not null default now(),
  unique (source_video_id)
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  script_type text not null,
  audience text not null,
  objective text not null,
  constraints text not null,
  key_points text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists script_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  brief_id uuid not null references briefs(id) on delete cascade,
  source_video_id uuid references source_videos(id) on delete set null,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists script_variants (
  id uuid primary key default gen_random_uuid(),
  script_job_id uuid not null references script_jobs(id) on delete cascade,
  variant_label text not null,
  mode text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists script_fixes (
  id uuid primary key default gen_random_uuid(),
  script_job_id uuid not null references script_jobs(id) on delete cascade,
  parent_variant_id uuid references script_variants(id) on delete set null,
  fix_request text not null,
  output_content text,
  created_at timestamptz not null default now()
);

create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  script_job_id uuid references script_jobs(id) on delete set null,
  source_video_id uuid references source_videos(id) on delete set null,
  title text not null,
  tags text[] default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- media system
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  source_path text not null,
  media_type text not null, -- video | image
  duration_seconds numeric,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create table if not exists media_derivatives (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  kind text not null, -- hero_1080_mp4 | hero_1080_webm | poster
  path text not null,
  codec text,
  created_at timestamptz not null default now(),
  unique (media_asset_id, kind)
);

create table if not exists thumbnail_candidates (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  frame_timecode text not null,
  image_path text not null,
  role_tag text not null, -- context | trust | process | texture
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists thumbnail_approvals (
  id uuid primary key default gen_random_uuid(),
  thumbnail_candidate_id uuid not null references thumbnail_candidates(id) on delete cascade,
  surface text not null default 'home',
  approved_by uuid,
  approved_at timestamptz not null default now(),
  unique (surface, thumbnail_candidate_id)
);

-- usage and billing readiness
create table if not exists usage_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  operation text not null,
  units int not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  max_users int,
  max_script_jobs_monthly int,
  max_review_assets_monthly int,
  created_at timestamptz not null default now()
);

create table if not exists org_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan_code text not null references plan_limits(plan_code),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_review_assets_org on review_assets(org_id);
create index if not exists idx_timecoded_comments_asset on timecoded_comments(asset_id);
create index if not exists idx_watchlists_org on watchlists(org_id);
create index if not exists idx_source_videos_org on source_videos(org_id);
create index if not exists idx_script_jobs_org on script_jobs(org_id);
create index if not exists idx_vault_items_org on vault_items(org_id);
create index if not exists idx_usage_ledger_org on usage_ledger(org_id);

