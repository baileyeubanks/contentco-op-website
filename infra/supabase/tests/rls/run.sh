#!/usr/bin/env bash
# Scratch-database RLS contract test for the CCO migrations.
# See infra/supabase/tests/rls/README.md.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../../../.." && pwd)"
migrations_dir="$repo_root/infra/supabase/migrations"
app_migrations_dir="$repo_root/apps/home/supabase/migrations"
db_name="${CCO_RLS_TEST_DB:-cco_rls_contract_test}"

# SQL is always streamed over stdin so the database OS user never needs read
# access to the repo checkout or the temp directory.
run_psql() {
  if [ -n "${PGHOST:-}" ] || [ -n "${PGUSER:-}" ]; then
    psql -v ON_ERROR_STOP=1 -X -q "$@"
  elif id postgres >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
    su postgres -c "psql -v ON_ERROR_STOP=1 -X -q $(printf '%q ' "$@")"
  else
    psql -v ON_ERROR_STOP=1 -X -q "$@"
  fi
}

run_sql_file() {
  local db="$1" file="$2"
  run_psql -d "$db" < "$file"
}

if ! command -v psql >/dev/null 2>&1; then
  echo "rls-test: psql is not installed; cannot run the scratch-database contract" >&2
  exit 2
fi

echo "rls-test: recreating scratch database $db_name"
run_psql -d postgres -c "drop database if exists \"$db_name\";"
run_psql -d postgres -c "create database \"$db_name\";"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Supabase-like roles and a stub auth schema so user_profiles / auth.uid() resolve.
cat > "$tmpdir/00_roles.sql" <<'SQL'
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL

# Live CCO-DB carries columns the repo never declared (contacts.business_unit is
# text[], contacts.title/website/address/source/location, events queue fields).
# The intake writer targets the live shape, so the scratch database gets the
# same additive columns before the repo migrations run.
cat > "$tmpdir/01_live_shape.sql" <<'SQL'
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  business_unit text[],
  status text not null default 'lead',
  contact_type text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contacts
  add column if not exists title text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists location text,
  add column if not exists source text default 'unknown';
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid,
  business_id uuid,
  type text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer default 0,
  event_version text default 'v1',
  business_unit text default 'ACS',
  channel text default 'legacy',
  direction text default 'inbound',
  text text,
  metadata jsonb default '{}'::jsonb,
  processing_state text default 'queued',
  idempotency_key text
);
SQL

echo "rls-test: applying CCO migrations"
run_sql_file "$db_name" "$tmpdir/00_roles.sql"
run_sql_file "$db_name" "$tmpdir/01_live_shape.sql"

applied=0
for file in $(ls "$migrations_dir"/*.sql "$app_migrations_dir"/*.sql | xargs -n1 basename | sort -u); do
  case "$file" in
    *acs_v1*|*job_applicants*) continue ;;  # ACS namespace: never part of the CCO contract
  esac
  # CCO_RLS_TEST_EXCLUDE=<substring> skips a migration so the assertions can be
  # shown to fail without it (negative proof). Never set in CI.
  if [ -n "${CCO_RLS_TEST_EXCLUDE:-}" ] && [[ "$file" == *"$CCO_RLS_TEST_EXCLUDE"* ]]; then
    echo "  - $file (EXCLUDED by CCO_RLS_TEST_EXCLUDE)"
    continue
  fi
  path="$migrations_dir/$file"
  [ -f "$path" ] || path="$app_migrations_dir/$file"
  echo "  - $file"
  run_sql_file "$db_name" "$path"
  applied=$((applied + 1))
done
echo "rls-test: applied $applied migration files"

echo "rls-test: running assertions"
run_sql_file "$db_name" "$here/assertions.sql"
echo "rls-test: PASS"
