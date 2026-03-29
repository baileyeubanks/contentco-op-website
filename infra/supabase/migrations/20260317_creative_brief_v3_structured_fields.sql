alter table creative_briefs
  add column if not exists booking_intent text,
  add column if not exists source_surface text,
  add column if not exists source_path text,
  add column if not exists submission_mode text,
  add column if not exists intake_payload jsonb,
  add column if not exists structured_intake jsonb,
  add column if not exists handoff_payload jsonb;

create index if not exists idx_creative_briefs_source_surface
  on creative_briefs(source_surface)
  where source_surface is not null;

create index if not exists idx_creative_briefs_submission_mode
  on creative_briefs(submission_mode)
  where submission_mode is not null;
