-- CCO-DB only (briokwdoonawhxisbydy). Source-only until Bailey approves the apply.
--
-- Why
--   The CCO tables declared by this repo's migrations are reached from the
--   application exclusively through the service-role client
--   (apps/home/lib/supabase.ts, apps/home/lib/cco-public-intake.ts). Nothing
--   in apps/home reads or writes them through the anon or authenticated role.
--   Yet most of those tables were created without `enable row level security`,
--   and the eleven ontology tables in 20260317_root_ontology_core.sql enable
--   RLS but attach `for all using (true) with check (true)` policies with no
--   `to` clause, which grants every role, anon included, full read/write/delete.
--
--   Supabase exposes every public table to the anon and authenticated roles
--   through PostgREST by default, so a table without RLS (or with an open
--   policy) is readable, editable and deletable by anyone holding the public
--   anon key. This migration closes that for every CCO table this repo owns.
--
-- What
--   For each CCO table that exists in the target database:
--     1. enable row level security;
--     2. install a `service_role_only_<table>` policy scoped TO service_role
--        (service_role bypasses RLS anyway; the explicit policy documents the
--        authorized path and keeps the table usable if BYPASSRLS is ever
--        removed from the role);
--     3. replace the open ontology policies (`service_role_<table>` to PUBLIC)
--        with the role-scoped policy above.
--   Policies that already exist under other names (for example the live
--   `anon_insert_quotes_public_intake` INSERT policy on quotes, or the orgs
--   member-read policies) are left untouched: this migration only adds the
--   service-role path and removes the known-open PUBLIC policies.
--
-- What it does NOT do
--   It does not revoke table privileges from anon/authenticated and it does
--   not add any anon/authenticated policy. With RLS enabled and no policy for
--   those roles, PostgREST returns zero rows and rejects writes, which is the
--   intended state for operator-only data.
--
-- ACS tables (acs_*, job_applicants) are out of scope and are not referenced.
--
-- Idempotent: safe to re-run.

do $$
declare
  cco_tables constant text[] := array[
    -- 20260224_content_coop_v21.sql
    'orgs', 'org_members', 'org_invites', 'sessions',
    'review_assets', 'asset_versions', 'timecoded_comments', 'approval_gates',
    'approval_decisions', 'review_events',
    'watchlists', 'watchlist_sources', 'source_videos', 'outlier_scores',
    'briefs', 'script_jobs', 'script_variants', 'script_fixes', 'vault_items',
    'media_assets', 'media_derivatives', 'thumbnail_candidates', 'thumbnail_approvals',
    'usage_ledger', 'plan_limits', 'org_plan_subscriptions',
    -- 20260225_onboarding_v1.sql
    'creative_briefs', 'brief_status_history', 'brief_messages', 'brief_files',
    -- 20260226_coedit_v2.sql
    'editing_projects', 'raw_uploads', 'soundbites', 'extraction_jobs',
    -- 20260226_user_profiles.sql
    'user_profiles',
    -- 20260306_root_ops_core.sql
    'work_claims', 'daily_handoffs', 'document_artifacts',
    -- 20260317_root_ontology_core.sql (foundation)
    'businesses', 'contacts', 'events', 'quotes', 'quote_items',
    'invoices', 'invoice_payments', 'contact_business_map',
    -- 20260317_root_ontology_core.sql (ontology layer)
    'companies', 'relationships', 'opportunities', 'projects', 'deliverables',
    'campaigns', 'campaign_contacts', 'payments', 'catalog_items',
    'automation_rules', 'automation_runs',
    -- 20260411_root_commercial_pipeline.sql
    'brief_scope_items', 'estimates', 'estimate_line_items', 'estimate_decisions',
    'approvals', 'approval_policies', 'payment_attempts', 'commercial_workflows',
    -- 20260811000000_estimate_versions.sql / 20260811000100_commercial_handoffs.sql
    'estimate_versions', 'commercial_handoffs',
    -- 20260822012747_cco_public_brief_persistence_20260819000000.sql
    'notification_log',
    -- apps/home/supabase/migrations
    'assistant_rate_limits', 'goals', 'agents',
    'contact_import_batches', 'contact_import_rows'
  ];
  open_ontology_policies constant text[] := array[
    'companies', 'relationships', 'opportunities', 'projects', 'deliverables',
    'campaigns', 'campaign_contacts', 'payments', 'catalog_items',
    'automation_rules', 'automation_runs'
  ];
  tbl text;
  policy_name text;
begin
  foreach tbl in array cco_tables loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise notice 'cco_rls_lockdown: public.% does not exist here; skipping', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    policy_name := format('service_role_only_%s', tbl);
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = tbl and policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        policy_name, tbl
      );
    end if;
  end loop;

  -- The ontology migration's policies were created without a `to` clause, so
  -- they apply to PUBLIC (anon and authenticated included). Remove them; the
  -- service_role_only_<table> policy above is the replacement.
  foreach tbl in array open_ontology_policies loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;
    policy_name := format('service_role_%s', tbl);
    if exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = tbl and policyname = policy_name
         and roles = '{public}'::name[]
    ) then
      execute format('drop policy %I on public.%I', policy_name, tbl);
    end if;
  end loop;
end $$;

-- Fail closed: every CCO table that exists must now have RLS enabled.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in (
       'orgs', 'org_members', 'org_invites', 'sessions', 'review_assets', 'asset_versions',
       'timecoded_comments', 'approval_gates', 'approval_decisions', 'review_events',
       'watchlists', 'watchlist_sources', 'source_videos', 'outlier_scores', 'briefs',
       'script_jobs', 'script_variants', 'script_fixes', 'vault_items', 'media_assets',
       'media_derivatives', 'thumbnail_candidates', 'thumbnail_approvals', 'usage_ledger',
       'plan_limits', 'org_plan_subscriptions', 'creative_briefs', 'brief_status_history',
       'brief_messages', 'brief_files', 'editing_projects', 'raw_uploads', 'soundbites',
       'extraction_jobs', 'user_profiles', 'work_claims', 'daily_handoffs', 'document_artifacts',
       'businesses', 'contacts', 'events', 'quotes', 'quote_items', 'invoices', 'invoice_payments',
       'contact_business_map', 'companies', 'relationships', 'opportunities', 'projects',
       'deliverables', 'campaigns', 'campaign_contacts', 'payments', 'catalog_items',
       'automation_rules', 'automation_runs', 'brief_scope_items', 'estimates',
       'estimate_line_items', 'estimate_decisions', 'approvals', 'approval_policies',
       'payment_attempts', 'commercial_workflows', 'estimate_versions', 'commercial_handoffs',
       'notification_log', 'assistant_rate_limits', 'goals', 'agents', 'contact_import_batches',
       'contact_import_rows'
     )
     and not c.relrowsecurity;

  if missing is not null then
    raise exception 'cco_rls_lockdown: row level security still disabled on: %', missing;
  end if;
end $$;
