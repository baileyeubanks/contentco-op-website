# Runbook: Auth Or Login Issue

## Trigger

Use this runbook when `/login` fails to render, Supabase auth cannot initialize, or sign-in attempts fail because the public runtime is misconfigured.

## Diagnose

1. Visit `/login`.
2. Check `GET /api/health?scope=local`.
3. Confirm the required auth env keys are present:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `CCO_SESSION_SECRET`

Relevant files:

1. [`apps/home/app/login/page.tsx`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/app/login/page.tsx)
2. [`apps/home/lib/supabase-browser.ts`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/supabase-browser.ts)
3. [`apps/home/lib/session.ts`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/session.ts)

## Recovery

1. Restore missing public Supabase env.
2. Confirm the browser client still points at the current project URL/key.
3. Re-run the public route smoke check.
4. Re-run `npm run ops:audit`.

## Exit Criteria

`/login` renders normally, auth initialization no longer errors, and repo-local health is healthy or degraded only for non-auth reasons.
