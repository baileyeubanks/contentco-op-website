-- CCO-DB only (briokwdoonawhxisbydy). Source-only until Bailey approves the apply.
--
-- Why
--   The public /brief route persisted a contact, a creative_briefs row and the
--   notification_log receipts, but never wrote the durable `brief_submitted`
--   event that CCO OS consumers read (apps/home/lib/os-marketing.ts,
--   apps/home/lib/creative-brief-quote-draft.ts both query
--   `events.type = 'brief_submitted'` and `payload.brief_id`).
--
--   The repo's own declaration of public.events
--   (20260317_root_ontology_core.sql) and the live CCO-DB table disagree:
--     * live has `idempotency_key` and `event_version` (plus a Blaze queue
--       contract: processing_state, attempts, locked_by, ...) that no repo
--       migration declares;
--     * the repo adds `object_type`, `object_id`, `event_category` inside an
--       `exception when others then null` block, and the live table does not
--       have them, so apps/home/lib/os-event-log.ts `emitTypedEvent` fails on
--       CCO-DB with an unknown-column error that is swallowed.
--   A source-only scratch database built from the repo migrations therefore
--   rejects an insert that the live database accepts, and vice versa.
--
-- What
--   Declare the intersection explicitly so both environments converge:
--     1. add the columns the public intake event writer relies on
--        (`idempotency_key`, `event_version`), no-ops where they already exist;
--     2. add the typed-event columns the OS writer relies on
--        (`object_type`, `object_id`, `event_category`), no-ops where present;
--     3. enforce exactly one `brief_submitted` event per public brief with a
--        partial unique index on the public-intake idempotency key namespace,
--        so a concurrent retry cannot double-insert and an operator can rely
--        on the row count.
--
-- Event contract (written by apps/home/lib/cco-public-intake.ts):
--   type             = 'brief_submitted'
--   business_unit    = 'CC'
--   channel          = 'website'
--   direction        = 'inbound'
--   contact_id       = contacts.id of the public lead
--   idempotency_key  = 'cco_public_brief_submitted:<creative_briefs.id>'
--   event_version    = 'cco.public-brief-submitted.v1'
--   payload          = { brief_id, contact_id, public_submission_id, source,
--                        source_path, structured_intake, intake_payload,
--                        idempotency_key, event_version }
--   metadata         = { source: 'cco_public_intake', idempotency_key,
--                        event_version }
--
-- Idempotent: safe to re-run.

alter table public.events
  add column if not exists idempotency_key text,
  add column if not exists event_version text not null default 'v1',
  add column if not exists object_type text,
  add column if not exists object_id uuid,
  add column if not exists event_category text;

create index if not exists idx_events_idempotency_key
  on public.events (idempotency_key);

create index if not exists idx_events_object
  on public.events (object_type, object_id);

create index if not exists idx_events_category
  on public.events (event_category);

-- Exactly one durable brief_submitted event per public brief. Scoped to the
-- public-intake key namespace so pre-existing rows written by other systems
-- (Blaze, ACS automations) with their own idempotency keys are unaffected.
create unique index if not exists idx_events_cco_public_brief_submitted_unique
  on public.events (idempotency_key)
  where idempotency_key like 'cco_public_brief_submitted:%';

-- Fail closed: the columns the intake writer uses must exist.
do $$
declare
  missing text;
begin
  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing
    from (values
      ('type'), ('business_unit'), ('channel'), ('direction'), ('contact_id'),
      ('text'), ('payload'), ('metadata'), ('idempotency_key'), ('event_version'),
      ('object_type'), ('object_id'), ('event_category')
    ) as required(column_name)
   where not exists (
     select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'events'
        and c.column_name = required.column_name
   );

  if missing is not null then
    raise exception 'events_brief_submitted_contract: public.events is missing columns: %', missing;
  end if;
end $$;
