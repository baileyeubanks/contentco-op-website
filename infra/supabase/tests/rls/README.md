# CCO-DB RLS contract tests

Source-only proof for the CCO migrations. Builds a scratch Postgres database
from the CCO migrations in `infra/supabase/migrations` (ACS files are skipped),
creates the Supabase roles (`anon`, `authenticated`, `service_role`) with the
same default privileges Supabase grants, and asserts:

1. **Authorized path works**: `service_role` can insert the public-intake
   contact, brief and `brief_submitted` event, and `notification_log` rows.
2. **Unauthorized path fails**: `anon` and `authenticated` see zero rows on
   every CCO table and cannot insert, update or delete.
3. **Event contract holds**: the columns the intake writer uses exist and the
   `brief_submitted` idempotency key is unique.

Run locally (needs a Postgres superuser; the container's `postgres` OS user
works):

```bash
bash infra/supabase/tests/rls/run.sh
```

Environment:

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` are honoured when set. When unset
  and the `postgres` OS user exists, the script runs `psql` as that user over
  the local socket.
- `CCO_RLS_TEST_DB` names the scratch database (default
  `cco_rls_contract_test`). It is dropped and recreated on every run.

The script exits non-zero on any failed assertion. It never connects to a
Supabase project.
