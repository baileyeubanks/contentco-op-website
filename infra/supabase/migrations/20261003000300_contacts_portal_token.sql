-- CCO-DB only (briokwdoonawhxisbydy). Source-only until Bailey approves the apply.
--
-- Why
--   The client portal (apps/home/app/api/client/portal/route.ts,
--   apps/home/app/client/portal/page.tsx, apps/home/app/api/client/[token]/*)
--   resolves a contact only from an opaque `contacts.portal_token`. That
--   column does not exist on live CCO-DB (column listing, 2026-10-03), so every
--   portal lookup fails closed with a database error today. This declares the
--   capability column so the token-only design can work once CCO OS mints
--   tokens; it does not mint or backfill any token.
--
-- Idempotent: safe to re-run.

alter table public.contacts
  add column if not exists portal_token text;

-- One contact per capability. Partial so the (many) contacts without a token
-- are unaffected.
create unique index if not exists idx_contacts_portal_token_unique
  on public.contacts (portal_token)
  where portal_token is not null;

-- Tokens are bearer capabilities: never short, never guessable from the email.
alter table public.contacts
  drop constraint if exists contacts_portal_token_length_check;
alter table public.contacts
  add constraint contacts_portal_token_length_check
  check (portal_token is null or length(portal_token) >= 32);
