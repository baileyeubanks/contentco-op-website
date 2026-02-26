-- =============================================================================
-- ACS (Astro Cleanings) Schema — v1
-- Migration: 20260225_acs_v1.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CLIENTS
-- Core record for every ACS client (residential or commercial)
-- ---------------------------------------------------------------------------
create table if not exists acs_clients (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone           text,
  email           text,

  -- Address (essential for ACS)
  address_line1   text,
  address_line2   text,
  city            text,
  state           text default 'TX',
  postal_code     text,
  geo_lat         double precision,
  geo_lng         double precision,

  -- Access info stored per-client (codes, gate, alarm, etc.)
  access_notes    text,

  -- Relationship
  client_type     text not null default 'residential'
                    check (client_type in ('residential','commercial')),
  status          text not null default 'active'
                    check (status in ('active','inactive','paused','lead')),
  source          text,                        -- 'calendar','wix-form','referral','manual'

  -- AI knowledge base
  ai_profile      text,
  notes           text,

  -- Sync
  google_cal_name text,                        -- canonical name as it appears on calendar
  blaze_contact_id integer,                    -- fk to contacts.db on Mac Mini (loose ref)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_acs_clients_status   on acs_clients(status);
create index if not exists idx_acs_clients_phone    on acs_clients(phone);
create index if not exists idx_acs_clients_name     on acs_clients(full_name);

-- ---------------------------------------------------------------------------
-- PROPERTIES
-- A client can have multiple service locations (home + business, etc.)
-- ---------------------------------------------------------------------------
create table if not exists acs_properties (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references acs_clients(id) on delete cascade,
  label         text not null default 'Primary',   -- 'Home', 'Hair Studio', 'Office'
  address_line1 text not null,
  address_line2 text,
  city          text,
  state         text default 'TX',
  postal_code   text,
  geo_lat       double precision,
  geo_lng       double precision,
  access_notes  text,                              -- gate, alarm, lock codes for this property
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_acs_properties_client on acs_properties(client_id);

-- ---------------------------------------------------------------------------
-- CREW MEMBERS
-- Caio + cleaners. Also used for Telegram notification routing.
-- ---------------------------------------------------------------------------
create table if not exists acs_crew (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone           text,
  email           text,
  role            text not null default 'cleaner'
                    check (role in ('owner','lead','cleaner')),
  telegram_id     text,                          -- Telegram user ID for notifications
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Seed Caio and Bailey
insert into acs_crew (full_name, phone, email, role, telegram_id) values
  ('Caio Gustin',   null, 'caio@astrocleanings.com',   'owner', '7124538299'),
  ('Bailey Eubanks', null, 'bailey@contentco-op.com',  'owner', '7747110667')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- JOBS (Bookings)
-- Core scheduling table. Single jobs and recurring series both land here.
-- ---------------------------------------------------------------------------
create table if not exists acs_jobs (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references acs_clients(id) on delete restrict,
  property_id         uuid references acs_properties(id) on delete set null,

  title               text not null,
  job_type            text not null default 'standard'
                        check (job_type in ('standard','deep','move_in','move_out','commercial','first')),
  status              text not null default 'scheduled'
                        check (status in ('scheduled','confirmed','in_progress','completed','canceled','no_show')),

  scheduled_start     timestamptz not null,
  scheduled_end       timestamptz,
  duration_minutes    integer,

  -- Recurrence
  is_recurring        boolean not null default false,
  recurrence_rule     text,                      -- RRULE string e.g. 'FREQ=WEEKLY;BYDAY=MO'
  recurrence_anchor   uuid,                      -- points to first job in series

  -- Access for this specific job
  access_notes        text,

  -- Pricing
  price_usd           numeric(10,2),
  paid                boolean not null default false,
  paid_at             timestamptz,
  payment_method      text,

  -- Google Calendar sync
  gcal_event_id       text unique,               -- event ID in caio@astrocleanings.com calendar
  gcal_synced_at      timestamptz,

  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_acs_jobs_client          on acs_jobs(client_id);
create index if not exists idx_acs_jobs_status          on acs_jobs(status);
create index if not exists idx_acs_jobs_scheduled_start on acs_jobs(scheduled_start);
create index if not exists idx_acs_jobs_gcal_event_id   on acs_jobs(gcal_event_id);

-- ---------------------------------------------------------------------------
-- JOB ASSIGNMENTS
-- Which crew member(s) are assigned to each job
-- ---------------------------------------------------------------------------
create table if not exists acs_job_assignments (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references acs_jobs(id) on delete cascade,
  crew_id       uuid not null references acs_crew(id) on delete cascade,
  role          text not null default 'cleaner',
  status        text not null default 'assigned'
                  check (status in ('assigned','confirmed','completed','no_show')),
  created_at    timestamptz not null default now(),
  unique (job_id, crew_id)
);

-- ---------------------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------------------
create table if not exists acs_quotes (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references acs_clients(id) on delete restrict,
  job_id          uuid references acs_jobs(id) on delete set null,
  quote_number    text not null unique,
  amount_usd      numeric(10,2) not null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
create table if not exists acs_invoices (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references acs_clients(id) on delete restrict,
  job_id          uuid references acs_jobs(id) on delete set null,
  invoice_number  text not null unique,
  amount_usd      numeric(10,2) not null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','paid','overdue','void')),
  due_at          timestamptz,
  paid_at         timestamptz,
  payment_method  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CLIENT KNOWLEDGE BASE
-- AI-enriched notes, conversation context, preferences per client
-- ---------------------------------------------------------------------------
create table if not exists acs_client_knowledge (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references acs_clients(id) on delete cascade,
  category      text not null default 'general'
                  check (category in ('general','preferences','access','history','enrichment','conversation')),
  title         text not null,
  content       text not null,
  source        text,                            -- 'ai','manual','email','sms','calendar'
  confidence    numeric(3,2),                    -- 0.0–1.0
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_acs_knowledge_client   on acs_client_knowledge(client_id);
create index if not exists idx_acs_knowledge_category on acs_client_knowledge(category);

-- ---------------------------------------------------------------------------
-- GCAL SYNC LOG
-- Track every push/pull from Google Calendar for debugging
-- ---------------------------------------------------------------------------
create table if not exists acs_gcal_sync_log (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('push','pull')),
  gcal_event_id text,
  job_id        uuid references acs_jobs(id) on delete set null,
  action        text not null,                   -- 'created','updated','deleted','skipped'
  details       jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: enable row-level security (lock down by default, open via policies)
-- ---------------------------------------------------------------------------
alter table acs_clients          enable row level security;
alter table acs_properties       enable row level security;
alter table acs_crew             enable row level security;
alter table acs_jobs             enable row level security;
alter table acs_job_assignments  enable row level security;
alter table acs_quotes           enable row level security;
alter table acs_invoices         enable row level security;
alter table acs_client_knowledge enable row level security;
alter table acs_gcal_sync_log    enable row level security;

-- Service role bypasses RLS (used by Blaze/OpenClaw backend)
-- Anon/authenticated roles get read-only on jobs for client portal (add policies as needed)
