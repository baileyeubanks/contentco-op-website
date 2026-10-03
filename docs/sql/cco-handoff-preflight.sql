-- Read-only metadata and aggregate verification. No customer records or secrets.
-- Review before using on the intended CCO project; do not substitute db push.
BEGIN TRANSACTION READ ONLY;
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_schema='public' AND table_name IN ('creative_briefs','estimates','estimate_versions','estimate_decisions','commercial_handoffs','events','projects'))
   OR (table_schema='co_production' AND table_name IN ('organizations','contacts','inquiries','projects','deliverables'))
ORDER BY table_schema, table_name, ordinal_position;
SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE (schemaname='co_production' AND tablename IN ('inquiries','projects','deliverables','organizations','contacts'))
   OR (schemaname='public' AND tablename IN ('commercial_handoffs','estimate_versions'))
ORDER BY schemaname, tablename, indexname;
SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname,
       pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='co_production' AND c.relname IN ('inquiries','projects','deliverables','contacts','organizations'))
   OR (n.nspname='public' AND c.relname IN ('creative_briefs','estimates','estimate_versions','estimate_decisions','commercial_handoffs'))
ORDER BY n.nspname,c.relname,k.conname;
SELECT 'legacy_projects' AS object, count(*) FROM public.projects
UNION ALL SELECT 'production_projects', count(*) FROM co_production.projects
UNION ALL SELECT 'briefs', count(*) FROM public.creative_briefs
UNION ALL SELECT 'estimates', count(*) FROM public.estimates
UNION ALL SELECT 'versions', count(*) FROM public.estimate_versions
UNION ALL SELECT 'receipts', count(*) FROM public.commercial_handoffs;
-- Expected applied version uniqueness is global, not per owner or variant:
-- idx_projects_cco_estimate_version_unique, idx_inquiries_cco_estimate_version_unique.
-- Owner validation is a separate parameterized read using the existing runtime
-- setting: SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = $1::uuid).
-- Do not print the owner value or any credential. Missing owner must block.
COMMIT;
