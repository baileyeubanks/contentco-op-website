-- DRAFT — NOT APPLIED. Rollback for migrations/20261027023000_revoke_anon_authenticated_os_tables.sql.
-- Lives outside migrations/ on purpose so `supabase db push` never runs it as a forward migration.
--
-- Restores EXACTLY the grants the forward migration revokes. Generated from the live CCO-DB ACLs
-- (read-only pg_class.relacl via aclexplode, 2026-10-27): on each table below both `anon` and
-- `authenticated` held SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
-- (= ALL), none WITH GRANT OPTION, and no column-level ACLs existed. GRANT ALL reproduces that set.
--
-- Deliberately NOT restored (nothing to restore, so granting would ADD privileges):
--   * tables that existed with empty anon/authenticated ACLs: mobile_sync_actions,
--     scenario_run_artifacts, scenario_runs, work_proof_manifests
--   * tables that did not exist: agents automation_rules automation_runs campaign_contacts
--     campaigns companies contact_import_batches contact_import_rows goals opportunities relationships
-- Re-check these against the live ACLs immediately before applying; if they differ, regenerate this file.
-- Idempotent; missing tables are skipped. Prefer NOT running this: it re-opens TRUNCATE to anon.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'estimates', 'estimate_versions', 'payment_attempts', 'estimate_decisions',
    'estimate_line_items', 'document_artifacts', 'commercial_handoffs', 'commercial_workflows',
    'daily_handoffs', 'work_claims',
    'root_billing_events', 'root_invoices', 'root_quotes', 'root_skill_registry'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END
$$;
