-- Assertions for the CCO RLS + brief_submitted contract. Runs after every CCO
-- migration has been applied to a scratch database by run.sh.
-- Every block raises on failure, so psql -v ON_ERROR_STOP=1 fails the run.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. Every CCO table has RLS enabled and a service_role policy.
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname not like 'acs\_%' and c.relname <> 'job_applicants'
     and not c.relrowsecurity;
  if bad is not null then
    raise exception 'RLS disabled on CCO tables: %', bad;
  end if;

  select string_agg(c.relname, ', ' order by c.relname) into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname not like 'acs\_%' and c.relname <> 'job_applicants'
     and not exists (
       select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
          and p.roles = '{service_role}'::name[]
     );
  if bad is not null then
    raise exception 'no service_role policy on CCO tables: %', bad;
  end if;

  -- No policy may apply to PUBLIC or anon with an unconditional USING (true).
  select string_agg(p.tablename || '.' || p.policyname, ', ') into bad
    from pg_policies p
   where p.schemaname = 'public'
     and (p.roles = '{public}'::name[] or p.roles @> '{anon}'::name[])
     and coalesce(p.qual, p.with_check, 'true') = 'true';
  if bad is not null then
    raise exception 'open policies to public/anon remain: %', bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Authorized path: service_role performs the full public-intake write set.
-- ---------------------------------------------------------------------------
set role service_role;

insert into public.contacts (name, email, company, business_unit, status, contact_type, source, metadata)
values ('Avery Brooks', 'avery@example.com', 'Example Industrial', array['CC'], 'lead', 'lead', 'contentco-op.com/brief', '{}'::jsonb);

insert into public.creative_briefs (contact_name, contact_email, company, company_account_id, data, source_path, booking_intent)
select 'Avery Brooks', 'avery@example.com', 'Example Industrial', 'content-co-op',
       jsonb_build_object('version', 'cco.public-brief.v1', 'public_submission_id', 'b4a6bb35-0062-4b95-9de0-3b12976465bb', 'contact_id', id::text),
       '/brief', 'discovery_call_20'
  from public.contacts where email = 'avery@example.com';

insert into public.events (type, business_unit, channel, direction, contact_id, text, payload, metadata, idempotency_key, event_version)
select 'brief_submitted', 'CC', 'website', 'inbound', c.id,
       'New public creative brief from Avery Brooks at Example Industrial',
       jsonb_build_object('brief_id', b.id::text, 'contact_id', c.id::text, 'public_submission_id', 'b4a6bb35-0062-4b95-9de0-3b12976465bb'),
       jsonb_build_object('source', 'cco_public_intake'),
       'cco_public_brief_submitted:' || b.id::text,
       'cco.public-brief-submitted.v1'
  from public.creative_briefs b join public.contacts c on c.id = (b.data ->> 'contact_id')::uuid;

insert into public.notification_log (recipient, channel, status, template_key, audience, business_unit, related_entity_type, related_entity_id, agent_identity)
select 'bailey@contentco-op.com', 'email', 'sending', 'cco_public_brief_admin_alert', 'internal', 'CC', 'creative_brief', b.id, 'cco-public-intake'
  from public.creative_briefs b;

do $$
declare n int;
begin
  select count(*) into n from public.creative_briefs where company_account_id = 'content-co-op';
  if n <> 1 then raise exception 'service_role brief insert failed (count=%)', n; end if;
  select count(*) into n from public.events where type = 'brief_submitted';
  if n <> 1 then raise exception 'service_role brief_submitted event insert failed (count=%)', n; end if;
  select count(*) into n from public.brief_status_history;
  if n <> 1 then raise exception 'brief status trigger did not fire (count=%)', n; end if;
  select count(*) into n from public.notification_log;
  if n <> 1 then raise exception 'service_role notification_log insert failed (count=%)', n; end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. Unauthorized path: anon and authenticated see nothing and cannot write.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.assert_role_locked_out(role_name text) returns void
language plpgsql as $$
declare
  tbl record;
  n bigint;
  blocked boolean;
begin
  execute format('set local role %I', role_name);
  for tbl in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname in ('contacts', 'creative_briefs', 'events', 'notification_log',
                         'brief_status_history', 'quotes', 'invoices', 'payments',
                         'estimates', 'commercial_workflows', 'user_profiles', 'sessions')
  loop
    execute format('select count(*) from public.%I', tbl.relname) into n;
    if n <> 0 then
      raise exception '% can read % rows from public.%', role_name, n, tbl.relname;
    end if;

    blocked := false;
    begin
      execute format('delete from public.%I', tbl.relname);
      execute format('select count(*) from public.%I', tbl.relname) into n;
      -- RLS filters the delete to zero rows; the data must survive as service_role.
    exception when insufficient_privilege then
      blocked := true;
    end;
  end loop;

  -- A direct insert into the intake tables must be rejected or filtered.
  blocked := false;
  begin
    insert into public.creative_briefs (contact_name, contact_email) values ('Mallory', 'mallory@example.com');
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception '% could insert into public.creative_briefs', role_name;
  end if;

  blocked := false;
  begin
    insert into public.events (type, payload) values ('brief_submitted', '{}'::jsonb);
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception '% could insert into public.events', role_name;
  end if;

  reset role;
end $$;

begin;
select pg_temp.assert_role_locked_out('anon');
rollback;

begin;
select pg_temp.assert_role_locked_out('authenticated');
rollback;

-- Data written by service_role survived the anon/authenticated delete attempts.
do $$
declare n int;
begin
  select count(*) into n from public.creative_briefs;
  if n <> 1 then raise exception 'creative_briefs rows were deleted by an unauthorized role (count=%)', n; end if;
  select count(*) into n from public.events where type = 'brief_submitted';
  if n <> 1 then raise exception 'brief_submitted events were deleted by an unauthorized role (count=%)', n; end if;
  select count(*) into n from public.contacts;
  if n <> 1 then raise exception 'contacts rows were deleted by an unauthorized role (count=%)', n; end if;
end $$;

-- converted status accepted by creative_briefs (20261002120000).
set role service_role;
update public.creative_briefs set status = 'converted';
reset role;
