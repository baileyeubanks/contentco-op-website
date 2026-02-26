-- Content Co-op Onboarding System
-- Creative briefs intake + client portal

-- Creative briefs submitted via /onboard
create table if not exists creative_briefs (
  id            uuid primary key default gen_random_uuid(),
  access_token  text unique not null default encode(gen_random_bytes(32), 'hex'),
  status        text not null default 'submitted'
                check (status in ('submitted','reviewed','in_progress','delivered','closed')),
  -- Contact
  contact_name  text not null,
  contact_email text not null,
  company       text,
  role          text,
  -- Scope
  content_type  text,
  deliverables  text,
  audience      text,
  tone          text,
  deadline      date,
  -- Creative
  objective     text,
  key_messages  text,
  "references"  text,
  constraints   text,
  -- Meta
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Status change history
create table if not exists brief_status_history (
  id         uuid primary key default gen_random_uuid(),
  brief_id   uuid not null references creative_briefs(id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- Threaded messages between client and CC team
create table if not exists brief_messages (
  id         uuid primary key default gen_random_uuid(),
  brief_id   uuid not null references creative_briefs(id) on delete cascade,
  sender     text not null check (sender in ('client','team')),
  body       text not null,
  created_at timestamptz not null default now()
);

-- File uploads (metadata — actual files in Supabase Storage)
create table if not exists brief_files (
  id           uuid primary key default gen_random_uuid(),
  brief_id     uuid not null references creative_briefs(id) on delete cascade,
  file_name    text not null,
  file_size    bigint,
  content_type text,
  storage_path text not null,
  uploaded_by  text not null check (uploaded_by in ('client','team')),
  created_at   timestamptz not null default now()
);

-- RLS: service role only (API routes use service key, bypasses RLS)
alter table creative_briefs enable row level security;
alter table brief_status_history enable row level security;
alter table brief_messages enable row level security;
alter table brief_files enable row level security;

-- Index for fast token lookups
create index if not exists idx_briefs_token on creative_briefs(access_token);
create index if not exists idx_briefs_email on creative_briefs(contact_email);
create index if not exists idx_brief_status_history_brief on brief_status_history(brief_id);
create index if not exists idx_brief_messages_brief on brief_messages(brief_id);
create index if not exists idx_brief_files_brief on brief_files(brief_id);

-- Insert initial status row on brief creation
create or replace function insert_brief_status() returns trigger as $$
begin
  insert into brief_status_history (brief_id, status, note)
  values (NEW.id, NEW.status, 'Brief submitted');
  return NEW;
end;
$$ language plpgsql;

create trigger trg_brief_created
  after insert on creative_briefs
  for each row execute function insert_brief_status();

-- Track status changes
create or replace function track_brief_status_change() returns trigger as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into brief_status_history (brief_id, status)
    values (NEW.id, NEW.status);
    NEW.updated_at = now();
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_brief_status_change
  before update on creative_briefs
  for each row execute function track_brief_status_change();
