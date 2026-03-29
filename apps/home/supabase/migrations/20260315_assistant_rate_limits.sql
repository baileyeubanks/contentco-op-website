create table if not exists public.assistant_rate_limits (
  ip text not null,
  hour_bucket timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (ip, hour_bucket)
);

-- Auto-delete entries older than 25 hours
create index if not exists idx_rate_limits_hour on public.assistant_rate_limits (hour_bucket);
