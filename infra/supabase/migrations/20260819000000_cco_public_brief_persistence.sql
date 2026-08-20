-- CCO-DB only: durable public-intake receipts and replay protection.
--
-- This contract matches the public /brief API. Apply it to CCO-DB
-- (briokwdoonawhxisbydy) before deploying the corresponding application
-- release. It is intentionally not an ACS migration.

create extension if not exists pgcrypto;

alter table public.creative_briefs
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists company_account_id text not null default 'content-co-op';

-- Keep a lower-case, literal lookup key separate from the display email.
-- PostgREST's ILIKE filter treats characters such as `_` as wildcards, so it
-- is not safe for identity lookup. Public CCO intake queries this exact key.
alter table public.contacts
  add column if not exists cco_public_email_key text;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  recipient text,
  channel text,
  status text default 'sent',
  message_preview text,
  contact_id uuid references public.contacts(id) on delete set null,
  metadata jsonb,
  created_at timestamptz default now(),
  agent_identity text,
  template_key text,
  risk_level text,
  approval_required boolean,
  approval_state text,
  audience text,
  business_unit text,
  subject text,
  body_text text,
  sent_at timestamptz,
  error_message text,
  related_entity_type text,
  related_entity_id uuid references public.creative_briefs(id) on delete set null
);

-- CCO-DB already has a notification_log table in some environments. The
-- public intake contract needs the same fields whether this migration creates
-- that table or extends the existing one.
alter table public.notification_log
  add column if not exists recipient text,
  add column if not exists channel text,
  add column if not exists status text default 'sent',
  add column if not exists message_preview text,
  add column if not exists contact_id uuid,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists agent_identity text,
  add column if not exists template_key text,
  add column if not exists risk_level text,
  add column if not exists approval_required boolean,
  add column if not exists approval_state text,
  add column if not exists audience text,
  add column if not exists business_unit text,
  add column if not exists subject text,
  add column if not exists body_text text,
  add column if not exists sent_at timestamptz,
  add column if not exists error_message text,
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id uuid;

alter table public.notification_log enable row level security;

-- CCO-DB has an array business_unit field, while older local schema snapshots
-- declare text. Keep the replay guard compatible with either representation.
do $$
declare
  business_unit_udt text;
begin
  select udt_name
    into business_unit_udt
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'contacts'
     and column_name = 'business_unit';

  if business_unit_udt = '_text' then
    update public.contacts
       set cco_public_email_key = lower(email)
     where email is not null
       and business_unit @> array['CC']::text[]
       and cco_public_email_key is distinct from lower(email);

    execute $sql$
      create unique index if not exists idx_contacts_cco_public_email_unique
        on public.contacts (cco_public_email_key)
        where cco_public_email_key is not null
          and business_unit @> array['CC']::text[]
    $sql$;
  elsif business_unit_udt = 'text' then
    update public.contacts
       set cco_public_email_key = lower(email)
     where email is not null
       and business_unit = 'CC'
       and cco_public_email_key is distinct from lower(email);

    execute $sql$
      create unique index if not exists idx_contacts_cco_public_email_unique
        on public.contacts (cco_public_email_key)
        where cco_public_email_key is not null
          and business_unit = 'CC'
    $sql$;
  else
    raise exception 'contacts.business_unit must be text or text[] before public-intake replay protection can be installed';
  end if;
end $$;

-- The browser UUID is the idempotency key for a final-form retry. A concurrent
-- duplicate fails safely and can replay the one stored brief on retry.
create unique index if not exists idx_creative_briefs_cco_public_submission_unique
  on public.creative_briefs ((data ->> 'public_submission_id'))
  where company_account_id = 'content-co-op'
    and data ? 'public_submission_id';

-- Exactly one delivery record exists per recipient/template/brief. A request
-- that times out after handing an email to the provider becomes an explicit
-- `unknown` outcome rather than being silently resent.
create unique index if not exists idx_notification_log_cco_public_brief_delivery_unique
  on public.notification_log (related_entity_type, related_entity_id, template_key, recipient)
  where related_entity_type = 'creative_brief'
    and template_key in ('cco_public_brief_admin_alert', 'cco_public_brief_client_receipt')
    and recipient is not null;

create index if not exists idx_notification_log_cco_public_brief_lookup
  on public.notification_log (related_entity_type, related_entity_id, template_key, recipient)
  where related_entity_type = 'creative_brief';
