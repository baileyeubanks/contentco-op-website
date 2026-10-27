-- DRAFT — NOT APPLIED. Owner gate D (CCO-DB migration) applies this, not the PR.
--
-- Step 1 of the CCO OS removal DB runbook. Read-only catalog check on CCO-DB
-- (2026-10-27 ~23:00 CT) found anon AND authenticated holding ALL privileges,
-- including TRUNCATE, on tables that only the retired CCO OS wrote or read.
-- RLS blocks REST row access on them, but TRUNCATE is not subject to RLS.
--
-- Effect: removes every privilege of anon and authenticated on these tables.
-- service_role (all server code) and the table owner are untouched, so nothing
-- that still works can break: no retained code path reaches these tables as
-- anon/authenticated. No data is changed, dropped or truncated.
-- Rollback: GRANT the privileges back (not recommended).
-- Idempotent: tables that do not exist are skipped.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- named by the lead (estimate/payment engine tables)
    'estimates', 'estimate_versions', 'payment_attempts',
    -- rest of the commercial family that carries the same anon/authenticated ALL grant
    'estimate_decisions', 'estimate_line_items', 'document_artifacts',
    'commercial_handoffs', 'commercial_workflows',
    -- tables referenced only by CCO OS code (code-derived; verify with the SQL in the runbook)
    'agents', 'automation_rules', 'automation_runs', 'campaign_contacts', 'campaigns',
    'companies', 'contact_import_batches', 'contact_import_rows', 'daily_handoffs',
    'goals', 'mobile_sync_actions', 'opportunities', 'relationships',
    'scenario_run_artifacts', 'scenario_runs', 'work_claims', 'work_proof_manifests',
    -- ROOT-era operator tables
    'root_billing_events', 'root_invoices', 'root_quotes', 'root_skill_registry'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END
$$;
