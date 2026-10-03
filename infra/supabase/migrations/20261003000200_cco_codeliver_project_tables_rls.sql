-- CCO-DB only (briokwdoonawhxisbydy). Source-only. BAILEY DECISION REQUIRED
-- before apply: see "Behaviour change" below.
--
-- Why
--   The live CCO-DB security advisor (2026-10-03, read-only check) reports
--   row level security DISABLED on public.projects, public.assets and
--   public.folders, with full INSERT/SELECT/UPDATE/DELETE grants to the anon
--   and authenticated roles. Anyone holding the public anon key can read,
--   edit or delete every row. Policies already exist on those tables
--   ("Users can insert own projects", "Users can insert own assets",
--   "Folders visible to project owner", ...) but are inert while RLS is off.
--
--   These are the Co-Deliver / Co-VideoPro project tables (owner_id uuid ->
--   auth.users), not the ontology `projects` table this repo declares in
--   20260317_root_ontology_core.sql. That declaration never applied to CCO-DB
--   (the live table has owner_id/name, not business_unit/title). Both shapes
--   are guarded for below.
--
-- What
--   1. enable RLS on projects, assets, folders where they exist;
--   2. service_role path (the application server);
--   3. owner-scoped read/update/delete for the authenticated owner, matching
--      the intent of the INSERT policies that already exist live.
--
-- Behaviour change (why this is a separate, flagged migration)
--   Enabling RLS activates the existing owner policies. Any Co-Deliver client
--   code that reads these tables with the anon key and no user session, or as
--   a team member who is not the project owner, will start receiving zero
--   rows. Blaze must verify the Co-Deliver read paths (team_members,
--   review_invites, share_links) before this is applied, or extend the
--   policies here first.
--
-- Idempotent: safe to re-run.

do $$
declare
  tbl text;
  has_owner boolean;
begin
  foreach tbl in array array['projects', 'assets', 'folders'] loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise notice 'codeliver_rls: public.% does not exist here; skipping', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = tbl
         and policyname = format('service_role_only_%s', tbl)
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        format('service_role_only_%s', tbl), tbl
      );
    end if;
  end loop;

  -- Owner-scoped policies only apply to the Co-Deliver shape (owner_id).
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projects' and column_name = 'owner_id'
  ) into has_owner;

  if has_owner then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_owner_select') then
      create policy projects_owner_select on public.projects
        for select to authenticated using (owner_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_owner_update') then
      create policy projects_owner_update on public.projects
        for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_owner_delete') then
      create policy projects_owner_delete on public.projects
        for delete to authenticated using (owner_id = auth.uid());
    end if;

    if to_regclass('public.assets') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assets' and column_name = 'project_id') then
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assets' and policyname = 'assets_owner_select') then
        create policy assets_owner_select on public.assets
          for select to authenticated
          using (exists (select 1 from public.projects p where p.id = assets.project_id and p.owner_id = auth.uid()));
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assets' and policyname = 'assets_owner_update') then
        create policy assets_owner_update on public.assets
          for update to authenticated
          using (exists (select 1 from public.projects p where p.id = assets.project_id and p.owner_id = auth.uid()))
          with check (exists (select 1 from public.projects p where p.id = assets.project_id and p.owner_id = auth.uid()));
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assets' and policyname = 'assets_owner_delete') then
        create policy assets_owner_delete on public.assets
          for delete to authenticated
          using (exists (select 1 from public.projects p where p.id = assets.project_id and p.owner_id = auth.uid()));
      end if;
    end if;
  end if;
end $$;

do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('projects', 'assets', 'folders')
     and not c.relrowsecurity;
  if missing is not null then
    raise exception 'codeliver_rls: row level security still disabled on: %', missing;
  end if;
end $$;
