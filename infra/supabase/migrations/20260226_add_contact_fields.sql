-- Add phone + location to creative_briefs
-- Run in Supabase SQL editor when ready (currently stored in constraints as fallback)

alter table creative_briefs add column if not exists phone text;
alter table creative_briefs add column if not exists location text;

-- Index for CRM lookups by phone
create index if not exists idx_briefs_phone on creative_briefs(phone) where phone is not null;
