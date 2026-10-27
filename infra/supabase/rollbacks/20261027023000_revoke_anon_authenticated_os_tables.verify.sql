-- Read-only verification for migration 20261027023000 and its rollback. Safe to run any time.
-- Expected BEFORE the migration: the 14 rollback tables show anon/authenticated = 8 privileges each.
-- Expected AFTER the migration: zero rows. Expected AFTER the rollback: same as BEFORE.
select c.relname as table_name, r.rolname as role, count(*) as privileges,
       string_agg(a.privilege_type, ',' order by a.privilege_type) as granted
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
cross join lateral aclexplode(c.relacl) a
join pg_roles r on r.oid = a.grantee and r.rolname in ('anon', 'authenticated')
where c.relname in (
  'estimates','estimate_versions','payment_attempts','estimate_decisions','estimate_line_items',
  'document_artifacts','commercial_handoffs','commercial_workflows','daily_handoffs','work_claims',
  'root_billing_events','root_invoices','root_quotes','root_skill_registry',
  'mobile_sync_actions','scenario_run_artifacts','scenario_runs','work_proof_manifests',
  'agents','automation_rules','automation_runs','campaign_contacts','campaigns','companies',
  'contact_import_batches','contact_import_rows','goals','opportunities','relationships')
group by 1, 2 order by 1, 2;
